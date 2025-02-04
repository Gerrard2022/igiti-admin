import { NextResponse } from 'next/server';
import prismadb from "@/lib/prismadb";

// Logging utility
const log = {
  info: (message: string) => console.log(`[PESAPAL_CHECKOUT] ${message}`),
  error: (message: string, error?: any) => console.error(`[PESAPAL_CHECKOUT_ERROR] ${message}`, error)
};

// Authentication for Pesapal
async function getPesapalToken(consumerKey: string, consumerSecret: string) {
  log.info('Attempting to get Pesapal authentication token');
  
  try {
    const response = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret })
    });

    log.info(`Token request response status: ${response.status}`);

    if (!response.ok) {
      log.error(`Failed to get token. Status: ${response.status}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      log.error(`Token request error: ${data.error}`);
      throw new Error(data.error);
    }

    log.info('Successfully retrieved Pesapal token');
    return data.token;
  } catch (error) {
    log.error('Authentication error', error);
    throw new Error('Failed to authenticate with Pesapal');
  }
}

// Submit order to Pesapal
async function submitPesapalOrder(token: string, orderData: any) {
  log.info('Submitting order to Pesapal');
  
  try {
    const response = await fetch('https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    log.info(`Order submission response status: ${response.status}`);

    if (!response.ok) {
      log.error(`Order submission HTTP error: ${response.status}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const orderResponse = await response.json();
    log.info('Order submitted successfully');
    return orderResponse;
  } catch (error) {
    log.error('Order submission error', error);
    throw new Error('Failed to submit order to Pesapal');
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  log.info(`Checkout process initiated for store: ${params.storeId}`);

  try {
    // Validate environment variables
    if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET || !process.env.PESAPAL_IPN_ID) {
      log.error('Missing Pesapal credentials or IPN ID');
      return new NextResponse("Payment configuration error", { status: 500 });
    }

    const body = await req.json();
    
    log.info(`Received request body: ${JSON.stringify(body)}`);
    
    const productIds = body.products.map((product: any) => product.productId);
    const quantities = body.products.map((product: any) => product.quantity);

    log.info(`Received order with ${productIds.length} products`);

    if (!productIds || productIds.length === 0) {
      log.error('No product IDs provided');
      return new NextResponse("Product ids are required", { status: 400 });
    }

    const order = await prismadb.order.create({
      data: {
        storeId: params.storeId,
        isPaid: false,
        orderItems: {
          create: productIds.map((productId: string, index: number) => ({
            product: { connect: { id: productId } },
            quantity: quantities[index]
          }))
        }
      },
      include: { orderItems: { include: { product: true } } }
    });

    log.info(`Order created in database with ID: ${order.id}`);

    const total = order.orderItems.reduce((acc, item) => {
      return acc + (item.product.price.toNumber() * item.quantity);
    }, 0);

    log.info(`Total order amount: ${total}`);

    const token = await getPesapalToken(
      process.env.PESAPAL_CONSUMER_KEY, 
      process.env.PESAPAL_CONSUMER_SECRET
    );

    const pesapalOrderData = {
      id: order.id,
      currency: "KES",
      amount: total,
      description: `Order ${order.id} from store ${params.storeId}`,
      callback_url: `${process.env.FRONTEND_STORE_URL}/cart?success=1`,
      notification_id: process.env.PESAPAL_IPN_ID, // Add the IPN ID here
      cancellation_url: `${process.env.FRONTEND_STORE_URL}/cart?canceled=1`,
      billing_address: {
        email_address: body.shippingDetails.email || "customer@example.com",
        phone_number: body.shippingDetails.phoneNumber || '0791055738',
        country_code: "KE", 
        first_name: body.shippingDetails.addressLine1 || "Customer",
        last_name: body.shippingDetails.country || "User",
      }
    };

    console.log('Pesapal Order Data:', JSON.stringify(pesapalOrderData, null, 2));

    const pesapalResponse = await submitPesapalOrder(token, pesapalOrderData);

    console.log('Full Pesapal Response:', JSON.stringify(pesapalResponse, null, 2));

    const orderTrackingId = 
      pesapalResponse.order_tracking_id || 
      pesapalResponse.orderTrackingId || 
      pesapalResponse.tracking_id;

    if (!orderTrackingId) {
      log.error('Failed to extract order tracking ID from response');
      log.error('Response details:', JSON.stringify(pesapalResponse, null, 2));
      throw new Error("No order tracking ID found in Pesapal response");
    }

    await prismadb.order.update({
      where: { id: order.id },
      data: { pesapalTrackingId: orderTrackingId }
    });

    log.info(`Order submitted successfully. Tracking ID: ${orderTrackingId}`);

    const redirectUrl = 
      pesapalResponse.redirect_url || 
      pesapalResponse.redirectUrl || 
      pesapalResponse.paymentUrl;

    if (!redirectUrl) {
      log.error('Failed to extract redirect URL from response');
      throw new Error("No redirect URL found in Pesapal response");
    }

    return NextResponse.json(
      { 
        orderId: order.id,
        url: redirectUrl 
      }, 
      { headers: corsHeaders }
    );

  } catch (error) {
    log.error('Checkout process failed', error);
    return new NextResponse("Internal error", { 
      status: 500,
      headers: corsHeaders 
    });
  }
}