import { NextResponse } from 'next/server';
import prismadb from "@/lib/prismadb";
import { PesapalTransactionStatusResponse } from "../checkout/types";

const log = {
  info: (message: string) => console.log(`[PESAPAL_IPN] ${message}`),
  error: (message: string, error?: any) => console.error(`[PESAPAL_IPN_ERROR] ${message}`, error)
};

async function getPesapalToken(consumerKey: string, consumerSecret: string): Promise<string> {
  try {
    const response = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    log.error('Failed to get Pesapal token', error);
    throw error;
  }
}

async function getTransactionStatus(orderTrackingId: string, token: string): Promise<PesapalTransactionStatusResponse> {
  const url = `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get transaction status: ${response.statusText}`);
  }

  return response.json();
}

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const orderTrackingId = searchParams.get('OrderTrackingId');

    if (!orderTrackingId) {
      log.error('Missing OrderTrackingId parameter');
      return new NextResponse(JSON.stringify({
        orderNotificationType: "IPNCHANGE",
        orderTrackingId,
        status: 500
      }));
    }

    log.info(`Processing IPN for tracking ID: ${orderTrackingId}`);

    // Find the order using the tracking ID
    const order = await prismadb.order.findFirst({
      where: { pesapalTrackingId: orderTrackingId }
    });

    if (!order) {
      log.error(`No order found for tracking ID: ${orderTrackingId}`);
      return new NextResponse(JSON.stringify({
        orderNotificationType: "IPNCHANGE",
        orderTrackingId,
        status: 500
      }));
    }

    const token = await getPesapalToken(
      process.env.PESAPAL_CONSUMER_KEY!,
      process.env.PESAPAL_CONSUMER_SECRET!
    );

    const transactionStatus = await getTransactionStatus(orderTrackingId, token);
    
    log.info(`Transaction status: ${JSON.stringify(transactionStatus)}`);

    // Update order status based on Pesapal response
    if (transactionStatus.payment_status_description === "COMPLETED") {
      await prismadb.order.update({
        where: { id: order.id },
        data: { 
          isPaid: true,
          // Update any other relevant fields
        }
      });
      
      log.info(`Order ${order.id} marked as paid`);
    }

    // Return the required IPN response format
    return new NextResponse(JSON.stringify({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference: order.id,
      status: 200
    }));

  } catch (error) {
    log.error('IPN processing failed', error);
    return new NextResponse(JSON.stringify({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: searchParams.get('OrderTrackingId'),
      status: 500
    }));
  }
} 