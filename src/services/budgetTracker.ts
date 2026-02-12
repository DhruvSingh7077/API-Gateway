// src/services/budgetTracker.ts
// Purpose: Track user spending and enforce budget limits

import { getCache, setCache, incrementCounter } from '../config/redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface BudgetStatus {
  currentSpending: number;
  budgetLimit: number;
  remainingBudget: number;
  percentageUsed: number;
  isOverBudget: boolean;
  isNearLimit: boolean; // 90% threshold
}

/**
 * Get Redis key for user's daily budget
 */
function getBudgetKey(userId: string, date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
  return `budget:${userId}:${dateStr}`;
}

/**
 * Get current spending for user today
 */
export async function getCurrentSpending(userId: string): Promise<number> {
  try {
    const budgetKey = getBudgetKey(userId);
    const spending = await getCache(budgetKey);
    
    return spending ? parseFloat(spending) : 0;
  } catch (error) {
    logger.error('Error getting current spending', error as Error, {
      userId,
    });
    return 0;
  }
}

/**
 * Add cost to user's daily spending
 */
export async function addToBudget(
  userId: string,
  costUsd: number
): Promise<number> {
  try {
    const budgetKey = getBudgetKey(userId);
    
    // Get current spending
    const currentSpending = await getCurrentSpending(userId);
    const newSpending = currentSpending + costUsd;
    
    // Update in Redis with 48-hour TTL (keeps yesterday's data)
    await setCache(budgetKey, newSpending.toString(), 60 * 60 * 48);
    
    logger.debug('Budget updated', {
      userId,
      previousSpending: currentSpending,
      costAdded: costUsd,
      newSpending,
    });
    
    return newSpending;
  } catch (error) {
    logger.error('Error updating budget', error as Error, {
      userId,
      costUsd,
    });
    return 0;
  }
}

/**
 * Check budget status for user
 */
export async function checkBudgetStatus(
  userId: string,
  dailyBudgetLimit: number
): Promise<BudgetStatus> {
  const currentSpending = await getCurrentSpending(userId);
  const remainingBudget = Math.max(0, dailyBudgetLimit - currentSpending);
  const percentageUsed = (currentSpending / dailyBudgetLimit) * 100;
  
  return {
    currentSpending,
    budgetLimit: dailyBudgetLimit,
    remainingBudget,
    percentageUsed,
    isOverBudget: currentSpending >= dailyBudgetLimit,
    isNearLimit: percentageUsed >= 90,
  };
}

/**
 * Check if user can afford a request
 */
export async function canAffordRequest(
  userId: string,
  dailyBudgetLimit: number,
  estimatedCost: number
): Promise<{
  allowed: boolean;
  reason?: string;
  budgetStatus: BudgetStatus;
}> {
  const status = await checkBudgetStatus(userId, dailyBudgetLimit);
  
  // Check if already over budget
  if (status.isOverBudget) {
    return {
      allowed: false,
      reason: 'Daily budget limit exceeded',
      budgetStatus: status,
    };
  }
  
  // Check if this request would exceed budget
  const projectedSpending = status.currentSpending + estimatedCost;
  if (projectedSpending > dailyBudgetLimit) {
    return {
      allowed: false,
      reason: `Request would exceed daily budget limit ($${dailyBudgetLimit})`,
      budgetStatus: status,
    };
  }
  
  return {
    allowed: true,
    budgetStatus: status,
  };
}

/**
 * Send budget alert
 */
export async function sendBudgetAlert(
  userId: string,
  budgetStatus: BudgetStatus,
  alertType: 'warning' | 'exceeded'
): Promise<void> {
  // Skip if alerts are disabled
  if (!config.features.budgetAlerts) {
    return;
  }

  try {
    const message = alertType === 'warning'
      ? `Budget warning: ${budgetStatus.percentageUsed.toFixed(1)}% of daily budget used ($${budgetStatus.currentSpending.toFixed(2)} / $${budgetStatus.budgetLimit})`
      : `Budget exceeded: Spent $${budgetStatus.currentSpending.toFixed(2)} of $${budgetStatus.budgetLimit} daily limit`;

    logger.warn(message, {
      userId,
      alertType,
      currentSpending: budgetStatus.currentSpending,
      budgetLimit: budgetStatus.budgetLimit,
      percentageUsed: budgetStatus.percentageUsed,
    });

    // TODO: Send actual alerts (email, webhook, etc.)
    // For now, just log it
    
  } catch (error) {
    logger.error('Error sending budget alert', error as Error, {
      userId,
      alertType,
    });
  }
}

/**
 * Track and alert on budget status
 */
export async function trackBudget(
  userId: string,
  costUsd: number,
  dailyBudgetLimit: number
): Promise<BudgetStatus> {
  // Add cost to budget
  const newSpending = await addToBudget(userId, costUsd);
  
  // Get updated status
  const status = await checkBudgetStatus(userId, dailyBudgetLimit);
  
  // Send alerts if needed
  if (status.isOverBudget) {
    await sendBudgetAlert(userId, status, 'exceeded');
  } else if (status.isNearLimit) {
    await sendBudgetAlert(userId, status, 'warning');
  }
  
  return status;
}

/**
 * Get spending history for user (last N days)
 */
export async function getSpendingHistory(
  userId: string,
  days: number = 7
): Promise<Array<{ date: string; spending: number }>> {
  const history: Array<{ date: string; spending: number }> = [];
  
  try {
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const dateStr = date.toISOString().split('T')[0];
      const budgetKey = getBudgetKey(userId, date);
      const spending = await getCache(budgetKey);
      
      history.push({
        date: dateStr,
        spending: spending ? parseFloat(spending) : 0,
      });
    }
    
    return history.reverse(); // Oldest first
  } catch (error) {
    logger.error('Error getting spending history', error as Error, {
      userId,
      days,
    });
    return [];
  }
}