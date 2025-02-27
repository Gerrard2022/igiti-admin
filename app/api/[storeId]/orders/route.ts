import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { isPaid, isSent, phone, address, orderItems, paymentMethod, paymentConfirmationCode, paymentDescription, paymentAccount } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", {
        status: 403,
      });
    }

    if (!isPaid) {
      return new NextResponse("Payment check is required", {
        status: 400,
      });
    }

    if (!isSent) {
      return new NextResponse("Mark if an order is sent or not", {
        status: 400,
      });
    }

    if (!phone) {
      return new NextResponse("Phone number is required", {
        status: 400,
      });
    }

    if (!address) {
      return new NextResponse("Address is required", {
        status: 400,
      });
    }

    if (!orderItems || orderItems.length === 0) {
      return new NextResponse("Need at least 1 order of a product", {
        status: 400,
      });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", {
        status: 400,
      });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      },
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", {
        status: 405,
      });
    }

    const order = await prismadb.order.create({
      data: {
        isPaid,
        isSent,
        phone,
        address,
        storeId: params.storeId,
        paymentMethod,
        paymentConfirmationCode,
        paymentDescription,
        paymentAccount,
        orderItems: {
          createMany: {
            data: orderItems.map((orderItem: { quantity: number; variant: string; product: string; }) => orderItem),
          },
        },
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.log("[ORDER_POST]", error);
    return new NextResponse("Internal error", {
      status: 500,
    });
  }
}

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    if (!params.storeId) {
      return new NextResponse("Store ID is required", {
        status: 400,
      });
    }

    const orders = await prismadb.order.findMany({
      where: {
        storeId: params.storeId,
      },
      include: {
        orderItems: true,
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.log("[ORDERS_GET]", error);
    return new NextResponse("Internal error", {
      status: 500,
    });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    const body = await req.json();

    const { isPaid, isSent, phone, address, orderItems, paymentMethod, paymentConfirmationCode, paymentDescription, paymentAccount } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", {
        status: 403,
      });
    }

    if (!params.storeId) {
      return new NextResponse("Store id is required", {
        status: 400,
      });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      },
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", {
        status: 405,
      });
    }

    const updateData: any = {
      ...(isPaid !== undefined && { isPaid }),
      ...(isSent !== undefined && { isSent }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(paymentMethod && { paymentMethod }),
      ...(paymentConfirmationCode && { paymentConfirmationCode }),
      ...(paymentDescription && { paymentDescription }),
      ...(paymentAccount && { paymentAccount }),
    };

    if (orderItems) {
      updateData.orderItems = {
        deleteMany: {},
        createMany: orderItems.map((orderItem: { quantity: number; variant: string; product: string; }) => orderItem),
      };
    }

    const order = await prismadb.order.update({
      where: {
        id: params.storeId,
      },
      data: updateData,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.log("[ORDER_PATCH]", error);
    return new NextResponse("Internal error", {
      status: 500,
    });
  }
}
