// Polar API client utilities
import { z } from 'zod';

const POLAR_API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://api.polar.sh'
  : 'https://sandbox-api.polar.sh';

export interface PolarCustomer {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface PolarProduct {
  id: string;
  name: string;
  description?: string;
  prices: PolarPrice[];
  created_at: string;
  updated_at: string;
}

export interface PolarPrice {
  id: string;
  amount: number; // in cents
  currency: string;
  recurring?: {
    interval: 'month' | 'year';
    interval_count: number;
  };
}

export interface PolarSubscription {
  id: string;
  customer_id: string;
  product_id: string;
  price_id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

class PolarClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.POLAR_ACCESS_TOKEN!;
    this.baseUrl = POLAR_API_BASE;
    
    if (!this.accessToken) {
      throw new Error('Polar access token is required');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Polar API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // Customer management
  async createCustomer(data: {
    email: string;
    name?: string;
  }): Promise<PolarCustomer> {
    return this.makeRequest('/v1/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCustomer(customerId: string): Promise<PolarCustomer> {
    return this.makeRequest(`/v1/customers/${customerId}`);
  }

  async getCustomerByEmail(email: string): Promise<PolarCustomer | null> {
    try {
      const response = await this.makeRequest(`/v1/customers?email=${encodeURIComponent(email)}`);
      return response.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching customer by email:', error);
      return null;
    }
  }

  async updateCustomer(customerId: string, data: {
    name?: string;
    email?: string;
  }): Promise<PolarCustomer> {
    return this.makeRequest(`/v1/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Product management
  async getProducts(): Promise<PolarProduct[]> {
    const response = await this.makeRequest('/v1/products');
    return response.data || [];
  }

  async getProduct(productId: string): Promise<PolarProduct> {
    return this.makeRequest(`/v1/products/${productId}`);
  }

  // Subscription management
  async getSubscription(subscriptionId: string): Promise<PolarSubscription> {
    return this.makeRequest(`/v1/subscriptions/${subscriptionId}`);
  }

  async getCustomerSubscriptions(customerId: string): Promise<PolarSubscription[]> {
    const response = await this.makeRequest(`/v1/subscriptions?customer_id=${customerId}`);
    return response.data || [];
  }

  async cancelSubscription(subscriptionId: string): Promise<PolarSubscription> {
    return this.makeRequest(`/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
    });
  }

  // Checkout utilities
  generateCheckoutUrl(params: {
    productId: string;
    priceId?: string;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, string>;
  }): string {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const checkoutUrl = new URL(`${baseUrl}/api/checkout`);
    
    // Add required product parameter
    checkoutUrl.searchParams.set('products', params.productId);
    
    // Add optional parameters
    if (params.priceId) {
      checkoutUrl.searchParams.set('priceId', params.priceId);
    }
    if (params.customerEmail) {
      checkoutUrl.searchParams.set('customerEmail', params.customerEmail);
    }
    if (params.customerName) {
      checkoutUrl.searchParams.set('customerName', params.customerName);
    }
    if (params.successUrl) {
      checkoutUrl.searchParams.set('successUrl', params.successUrl);
    }
    if (params.cancelUrl) {
      checkoutUrl.searchParams.set('cancelUrl', params.cancelUrl);
    }
    if (params.metadata) {
      checkoutUrl.searchParams.set('metadata', JSON.stringify(params.metadata));
    }
    
    return checkoutUrl.toString();
  }

  generateCustomerPortalUrl(customerId: string): string {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    return `${baseUrl}/api/portal?customerId=${customerId}`;
  }
}

// Export singleton instance
export const polarClient = new PolarClient();

// Export class for custom instances
export { PolarClient };

// Utility functions
export async function getOrCreateCustomer(email: string, name?: string): Promise<PolarCustomer> {
  try {
    // Try to get existing customer
    let customer = await polarClient.getCustomerByEmail(email);
    
    if (!customer) {
      // Create new customer
      customer = await polarClient.createCustomer({ email, name });
    }
    
    return customer;
  } catch (error) {
    console.error('Error getting or creating customer:', error);
    throw error;
  }
}

export async function getUserSubscriptionStatus(email: string): Promise<{
  hasActiveSubscription: boolean;
  subscription?: PolarSubscription;
  tier: 'free' | 'pro' | 'enterprise';
}> {
  try {
    const customer = await polarClient.getCustomerByEmail(email);
    
    if (!customer) {
      return { hasActiveSubscription: false, tier: 'free' };
    }
    
    const subscriptions = await polarClient.getCustomerSubscriptions(customer.id);
    const activeSubscription = subscriptions.find(sub => sub.status === 'active');
    
    if (!activeSubscription) {
      return { hasActiveSubscription: false, tier: 'free' };
    }
    
    // Determine tier based on subscription (you'll need to customize this logic)
    const tier = determineTierFromSubscription(activeSubscription);
    
    return {
      hasActiveSubscription: true,
      subscription: activeSubscription,
      tier,
    };
  } catch (error) {
    console.error('Error getting user subscription status:', error);
    return { hasActiveSubscription: false, tier: 'free' };
  }
}

function determineTierFromSubscription(subscription: PolarSubscription): 'free' | 'pro' | 'enterprise' {
  // This is a placeholder - implement based on your actual product structure
  // You might need to fetch the product details to determine the tier
  return 'pro'; // Default for now
}