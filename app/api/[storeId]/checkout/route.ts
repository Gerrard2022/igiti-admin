import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

interface RequestBody {
  products: {
    productId: string;
    quantity: number;
  }[];
  shippingDetails: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phoneNumber: string;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Origin",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const { products, shippingDetails } = (await req.json()) as RequestBody;

  if (!products || products.length === 0) {
    return new NextResponse("Products are required", { status: 400 });
  }

  if (!shippingDetails) {
    return new NextResponse("Shipping details are required", { status: 400 });
  }

  const line_items: any[] = [];

  try {
    const result = await prismadb.$transaction(async (tx) => {
      for (const productData of products) {
        const product = await tx.product.findUnique({
          where: { id: productData.productId },
        });

        if (!product) {
          throw new Error(`Product with ID ${productData.productId} not found.`);
        }

        if (product.inStock < productData.quantity) {
          throw new Error(`Not enough stock for ${product.name}.`);
        }

        line_items.push({
          name: product.name,
          quantity: productData.quantity,
          unit_amount: product.price.toNumber() * 100, // Convert to cents
        });

        // Update stock
        await tx.product.update({
          where: { id: productData.productId },
          data: { inStock: product.inStock - productData.quantity },
        });
      }

      if (line_items.length === 0) {
        throw new Error("No products available.");
      }

      const createdShippingDetails = await tx.shippingDetails.create({
        data: shippingDetails,
      });

      const order = await tx.order.create({
        data: {
          storeId: params.storeId,
          isPaid: false,
          orderItems: {
            create: products.map((productData) => ({
              product: {
                connect: {
                  id: productData.productId,
                },
              },
              quantity: productData.quantity,
            })),
          },
          shippingDetailsId: createdShippingDetails.id,
        },
      });

      return { order, totalAmount: line_items.reduce((total, item) => total + item.unit_amount * item.quantity, 0) / 100 };
    });

    const { order, totalAmount } = result;

    // Create a payment link using Flutterwave API
    const paymentPayload = {
      tx_ref: `order_${order.id}_${Date.now()}`,
      amount: totalAmount,
      currency: "USD",
      redirect_url: `${process.env.FRONTEND_STORE_URL}/success`,
      customer: {
        email: "customer@example.com", // Replace or fetch dynamically
        phone_number: shippingDetails.phoneNumber,
        name: `${shippingDetails.city}, ${shippingDetails.state}`,
      },
      meta: {
        orderId: order.id,
      },
      customizations: {
        title: "E-Commerce Store",
        description: "Payment for your order",
      },
    };

    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    const flutterwaveData = await flutterwaveResponse.json();

    if (!flutterwaveData.status || flutterwaveData.status !== "success") {
      throw new Error(flutterwaveData.message || "Payment initiation failed.");
    }

    return NextResponse.json(
      { url: flutterwaveData.data.link },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Checkout Error:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
