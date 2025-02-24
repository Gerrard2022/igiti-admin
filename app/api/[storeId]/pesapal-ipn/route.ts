import { NextResponse } from 'next/server';
import prismadb from "@/lib/prismadb";

const log = {
  info: (message: string) => console.log(`[PESAPAL_IPN] ${message}`),
  error: (message: string, error?: any) => console.error(`[PESAPAL_IPN_ERROR] ${message}`, error)
};

async function getPesapalToken(consumerKey: string, consumerSecret: string) {
  // Reuse the token fetching logic from checkout/route.ts
  // ... (copy the function from checkout/route.ts)
}

async function getTransactionStatus(orderTrackingId: string, token: string): Promise<any> {
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
    const orderMerchantReference = searchParams.get('OrderMerchantReference');

    if (!orderTrackingId || !orderMerchantReference) {
      log.error('Missing required parameters');
      return new NextResponse(JSON.stringify({
        orderNotificationType: "IPNCHANGE",
        orderTrackingId,
        orderMerchantReference,
        status: 500
      }));
    }

    log.info(`Processing IPN for order ${orderMerchantReference}`);

    const token = await getPesapalToken(
      process.env.PESAPAL_CONSUMER_KEY!,
      process.env.PESAPAL_CONSUMER_SECRET!
    );

    const transactionStatus = await getTransactionStatus(orderTrackingId, token);
    
    log.info(`Transaction status: ${JSON.stringify(transactionStatus)}`);

    // Update order status based on Pesapal response
    if (transactionStatus.payment_status_description === "COMPLETED") {
      await prismadb.order.update({
        where: { id: orderMerchantReference },
        data: { isPaid: true }
      });
      
      log.info(`Order ${orderMerchantReference} marked as paid`);
    }

    // Return the required IPN response format
    return new NextResponse(JSON.stringify({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference,
      status: 200
    }));

  } catch (error) {
    log.error('IPN processing failed', error);
    return new NextResponse(JSON.stringify({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: searchParams.get('OrderTrackingId'),
      orderMerchantReference: searchParams.get('OrderMerchantReference'),
      status: 500
    }));
  }
} 