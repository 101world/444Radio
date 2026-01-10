// Razorpay Plan Configuration for 444Radio
// All plans with their IDs, prices, and credit allocations

export const RAZORPAY_PLANS = {
  creator: {
    monthly: {
      planId: 'plan_S2DGVK6J270rtt',
      price: 450,
      credits: 100,
      period: 'month'
    },
    annual: {
      planId: 'plan_S2DJv0bFnWoNLS',
      price: 4420,
      credits: 1200, // 100/month × 12
      period: 'year'
    }
  },
  pro: {
    monthly: {
      planId: 'plan_S2DHUGo7n1m6iv',
      price: 1355,
      credits: 600,
      period: 'month'
    },
    annual: {
      planId: 'plan_S2DNEvy1YzYWNh',
      price: 13090,
      credits: 7200, // 600/month × 12
      period: 'year'
    }
  },
  studio: {
    monthly: {
      planId: 'plan_S2DIdCKNcV6TtA',
      price: 3160,
      credits: 1500,
      period: 'month'
    },
    annual: {
      planId: 'plan_S2DOABOeGedJHk',
      price: 30330,
      credits: 18000, // 1500/month × 12
      period: 'year'
    }
  }
} as const

export type PlanType = 'creator' | 'pro' | 'studio'
export type BillingCycle = 'monthly' | 'annual'

export function getPlanConfig(plan: PlanType, billing: BillingCycle) {
  return RAZORPAY_PLANS[plan][billing]
}

export function getPlanFromId(planId: string): { plan: PlanType; billing: BillingCycle; config: any } | null {
  for (const [planName, billingTypes] of Object.entries(RAZORPAY_PLANS)) {
    for (const [billingType, config] of Object.entries(billingTypes)) {
      if (config.planId === planId) {
        return {
          plan: planName as PlanType,
          billing: billingType as BillingCycle,
          config
        }
      }
    }
  }
  return null
}
