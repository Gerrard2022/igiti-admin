// pesapalService.ts

import { NextResponse } from 'next/server';
import prismadb from "@/lib/prismadb";

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error?: string;
}

interface PesapalIPNResponse {
  url: string;
  created_date: string;
  ipn_id: string;
  notification_type: number;
  ipn_notification_type_description: string;
  ipn_status: number;
  ipn_status_description: string;
  error: any;
  status: string;
}

interface PesapalConfig {
  consumer_key: string;
  consumer_secret: string;
  environment?: 'sandbox' | 'production';
}

export class PesapalService {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly baseUrl: string;

  constructor(private readonly config: PesapalConfig) {
    this.baseUrl = config.environment === 'production' 
      ? 'https://pay.pesapal.com/v3/api'
      : 'https://cybqa.pesapal.com/v3/api';
  }

  private async getAuthToken(): Promise<string> {
    // Return existing token if still valid
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    try {
      const response = await fetch(`${this.baseUrl}/Auth/RequestToken`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consumer_key: this.config.consumer_key,
          consumer_secret: this.config.consumer_secret
        })
      });

      const data = await response.json() as PesapalAuthResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      this.token = data.token;
      this.tokenExpiry = new Date(data.expiryDate);

      return this.token;
    } catch (error) {
      console.error('Pesapal authentication error:', error);
      throw new Error('Failed to authenticate with Pesapal');
    }
  }

  async registerIPN(storeId: string): Promise<string> {
    const token = await this.getAuthToken();
    const ipnUrl = `${process.env.FRONTEND_STORE_URL}/api/${storeId}/ipn`;

    try {
      const response = await fetch(`${this.baseUrl}/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: ipnUrl,
          ipn_notification_type: "GET"
        })
      });

      const data = await response.json() as PesapalIPNResponse;

      if (data.error) {
        throw new Error(JSON.stringify(data.error));
      }

      // Store the IPN ID in the database for the store
      await prismadb.store.update({
        where: { id: storeId },
        data: { 
          pesapalIpnId: data.ipn_id,
          pesapalIpnUrl: ipnUrl
        },
      });

      return data.ipn_id;
    } catch (error) {
      console.error('IPN registration error:', error);
      throw new Error('Failed to register IPN URL');
    }
  }

  async getOrCreateIPN(storeId: string): Promise<string> {
    // Check if store already has an IPN ID
    const store = await prismadb.store.findUnique({
      where: { id: storeId },
      select: { pesapalIpnId: true }
    });

    if (store?.pesapalIpnId) {
      return store.pesapalIpnId;
    }

    // If no IPN ID exists, register a new one
    return this.registerIPN(storeId);
  }

  async submitOrder(orderData: any, storeId: string): Promise<any> {
    const token = await this.getAuthToken();
    
    // Ensure we have an IPN ID
    const ipnId = await this.getOrCreateIPN(storeId);
    
    // Add the IPN ID to the order data
    const orderPayloadWithIpn = {
      ...orderData,
      notification_id: ipnId
    };

    try {
      const response = await fetch(`${this.baseUrl}/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderPayloadWithIpn)
      });

      return await response.json();
    } catch (error) {
      console.error('Order submission error:', error);
      throw new Error('Failed to submit order to Pesapal');
    }
  }

  async getTransactionStatus(orderTrackingId: string): Promise<any> {
    const token = await this.getAuthToken();

    try {
      const response = await fetch(
        `${this.baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Transaction status check error:', error);
      throw new Error('Failed to get transaction status');
    }
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Your existing POST logic here
    const response = { /* your response */ };
    
    return NextResponse.json(response, {
      headers: corsHeaders
    });
  } catch (error) {
    console.log('[CHECKOUT_POST]', error);
    return new NextResponse("Internal error", { 
      status: 500,
      headers: corsHeaders 
    });
  }
}