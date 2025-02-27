import { NextResponse } from 'next/server';
import prismadb from "@/lib/prismadb";

// Logging utility
const log = {
  info: (message: string) => console.log(`[PESAPAL] ${message}`),
  error: (message: string, error?: any) => console.error(`[PESAPAL_ERROR] ${message}`, error)
};

// Add interfaces at the top of the file
interface PesapalAuthResponse {
  token: string;
  error?: string;
}

interface PesapalIpnResponse {
  ipn_id: string;
}

interface PesapalOrderResponse {
  order_tracking_id?: string;
  orderTrackingId?: string;
  tracking_id?: string;
  redirect_url?: string;
  redirectUrl?: string;
  paymentUrl?: string;
}

interface CheckoutRequestBody {
  products: Array<{ productId: string; quantity: number }>;
  shippingDetails: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phoneNumber: string;
  };
  location?: string;
}

// Update the TransactionStatus interface to match Pesapal's response
interface TransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: PesapalStatusCode;
  merchant_reference: string;
  payment_status_code: string;
  currency: string;
  error: {
    error_type: string | null;
    code: string | null;
    message: string | null;
    call_back_url: string | null;
  };
  status: string;
}

// Add this enum for better type safety
enum PesapalStatusCode {
  INVALID = 0,
  COMPLETED = 1,
  FAILED = 2,
  REVERSED = 3
}

// Update OrderStatus type to match all possible states
type OrderStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED' | 'PROCESSING';

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

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json() as PesapalAuthResponse;
    
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

// Register IPN URL with Pesapal
async function registerIpnUrl(token: string, storeId: string) {
  log.info('Registering IPN URL with Pesapal');
  
  const ipnUrl = `${process.env.FRONTEND_STORE_URL}/api/${storeId}/checkout`;
  
  try {
    const response = await fetch('https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN', {
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

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json() as PesapalIpnResponse;
    log.info('IPN URL registered successfully');
    
    // Store IPN details in database
    await prismadb.store.update({
      where: { id: storeId },
      data: {
        pesapalIpnId: data.ipn_id,
        pesapalIpnUrl: ipnUrl
      }
    });

    return data.ipn_id;
  } catch (error) {
    log.error('IPN registration error', error);
    throw new Error('Failed to register IPN URL');
  }
}

// Submit order to Pesapal
async function submitPesapalOrder(token: string, orderData: any): Promise<PesapalOrderResponse> {
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

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const orderResponse = await response.json() as PesapalOrderResponse;
    return orderResponse;
  } catch (error) {
    log.error('Order submission error', error);
    throw new Error('Failed to submit order to Pesapal');
  }
}

// Update the getTransactionStatus function
async function getTransactionStatus(token: string, orderTrackingId: string): Promise<TransactionStatus> {
  const url = `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    }
  });
  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_STORE_URL || "",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true"
} as const;

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
    if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET) {
      log.error('Missing Pesapal credentials');
      return new NextResponse("Missing Pesapal credentials", { status: 500 });
    }

    const token = await getPesapalToken(
      process.env.PESAPAL_CONSUMER_KEY, 
      process.env.PESAPAL_CONSUMER_SECRET
    );

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: { pesapalIpnId: true }
    });

    let ipnId = store?.pesapalIpnId;
    if (!ipnId) {
      ipnId = await registerIpnUrl(token, params.storeId);
    }

    const body = await req.json() as CheckoutRequestBody;
    
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

// Define African countries (keep the existing list)
const africanCountries = [
  "Rwanda", "Kenya", "Uganda", "Tanzania", "Burundi", 
  "Nigeria", "South Africa", "Egypt", "Algeria", "Morocco",
  "Ethiopia", "Ghana", "Angola", "Mozambique"
];

// Detect if the country is in Africa by checking the shipping country
const shippingCountry = body.shippingDetails?.country || "unknown";
const isAfrica = africanCountries.some(africanCountry => 
  shippingCountry.toLowerCase().includes(africanCountry.toLowerCase()) ||
  africanCountry.toLowerCase().includes(shippingCountry.toLowerCase())
);

    // Calculate total with appropriate currency
    const total = order.orderItems.reduce((acc, item) => {
      const itemTotal = item.product.price.toNumber() * item.quantity;
      return acc + (isAfrica ? itemTotal * 1000 : itemTotal);
    }, 0);

// Update the pesapalOrderData object to use the registered IPN ID
const pesapalOrderData = {
  id: order.id,
  currency: isAfrica ? "RWF" : "USD",
  amount: total,
  description: `Order ${order.id} from store ${params.storeId}`,
  callback_url: `${process.env.FRONTEND_STORE_URL}/cart?orderId=${order.id}&status=success`,
  cancellation_url: `${process.env.FRONTEND_STORE_URL}/cart?orderId=${order.id}&status=canceled`,
  notification_id: ipnId,
  ipn_url: `/api/${params.storeId}/checkout`,
  billing_address: {
    email_address: "",
    phone_number: body.shippingDetails.phoneNumber || "",
    first_name: "",
    last_name: "",
    line_1: body.shippingDetails.addressLine1 || ""
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
      data: { 
        pesapalTrackingId: orderTrackingId
      }
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


// Update the handlePaymentStatus function to use more response data
async function handlePaymentStatus(
  orderId: string, 
  trackingId: string, 
  storeId: string
): Promise<{ status: OrderStatus; isPaid: boolean; details: any }> {
  console.log("CONFIRMATIN CODE IS ABOUT TO RUN!!!!!!!");
  try {
    const order = await prismadb.order.findFirst({
      where: { 
        id: orderId,
        storeId: storeId
      }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const token = await getPesapalToken(
      process.env.PESAPAL_CONSUMER_KEY!,
      process.env.PESAPAL_CONSUMER_SECRET!
    );

    const transactionStatus = await getTransactionStatus(token, trackingId);
    
    console.log('Payment Status Check:', {
      orderId,
      status: transactionStatus.payment_status_description,
      statusCode: transactionStatus.status_code,
      paymentMethod: transactionStatus.payment_method,
      amount: transactionStatus.amount,
      currency: transactionStatus.currency,
      confirmationCode: transactionStatus.confirmation_code,
      paymentAccount: transactionStatus.payment_account,
      description: transactionStatus.description,
      createdDate: transactionStatus.created_date
    });

    let newStatus: OrderStatus;
    let isPaid = false;

    // Map Pesapal status to our status
    switch (transactionStatus.status_code) {
      case PesapalStatusCode.COMPLETED:
        newStatus = 'COMPLETED';
        isPaid = true;
        break;
      case PesapalStatusCode.FAILED:
        newStatus = 'FAILED';
        isPaid = false;
        break;
      case PesapalStatusCode.REVERSED:
        newStatus = 'REVERSED';
        isPaid = false;
        break;
      case PesapalStatusCode.INVALID:
        newStatus = 'FAILED';
        isPaid = false;
        break;
      default:
        newStatus = 'PROCESSING';
        isPaid = false;
    }

    // Store more payment details in the order
    await prismadb.order.update({
      where: { id: orderId },
      data: { 
        isPaid: isPaid,
        paymentMethod: transactionStatus.payment_method,
        paymentConfirmationCode: transactionStatus.confirmation_code,
        paymentDescription: transactionStatus.description,
        paymentAccount: transactionStatus.payment_account,
        paymentDate: new Date(transactionStatus.created_date)
      }
    });

    console.log('Order status updated:', {
      orderId,
      status: newStatus,
      isPaid,
      paymentMethod: transactionStatus.payment_method,
      confirmationCode: transactionStatus.confirmation_code
    });

    // Return detailed payment information
    return { 
      status: newStatus, 
      isPaid,
      details: {
        paymentMethod: transactionStatus.payment_method,
        amount: transactionStatus.amount,
        currency: transactionStatus.currency,
        confirmationCode: transactionStatus.confirmation_code,
        description: transactionStatus.description,
        paymentAccount: transactionStatus.payment_account,
        paymentDate: transactionStatus.created_date
      }
    };
  } catch (error) {
    console.error('Payment status check failed:', error);
    throw error;
  }
}

// Update the GET endpoint to handle status checks
export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const orderTrackingId = searchParams.get('OrderTrackingId');

    console.log('Payment Callback Received:', {
      orderId,
      status,
      orderTrackingId,
      timestamp: new Date().toISOString()
    });

    // Handle IPN notifications from Pesapal
    if (orderTrackingId) {
      const order = await prismadb.order.findFirst({
        where: { pesapalTrackingId: orderTrackingId }
      });

      if (!order) {
        return new NextResponse(JSON.stringify({
          orderNotificationType: "IPNCHANGE",
          orderTrackingId,
          status: 500
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await handlePaymentStatus(order.id, orderTrackingId, order.storeId);

      return new NextResponse(JSON.stringify({
        orderNotificationType: "IPNCHANGE",
        orderTrackingId,
        orderMerchantReference: order.id,
        status: 200
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle status check requests from frontend
    if (orderId) {
      const order = await prismadb.order.findFirst({
        where: { 
          id: orderId,
          storeId: params.storeId
        }
      });

      if (!order?.pesapalTrackingId) {
        return new NextResponse(JSON.stringify({ 
          error: 'Order not found or no tracking ID',
          status: 'error' 
        }), { status: 404 });
      }

      const result = await handlePaymentStatus(
        orderId, 
        order.pesapalTrackingId, 
        params.storeId
      );

      return new NextResponse(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new NextResponse(JSON.stringify({ error: 'Invalid request' }), { 
      status: 400 
    });

  } catch (error) {
    console.error('Payment processing failed:', error);
    return new NextResponse(JSON.stringify({
      error: 'Payment processing failed',
      status: 'error'
    }), { status: 500 });
  }
}