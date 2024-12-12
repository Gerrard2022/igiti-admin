import { format } from "date-fns";

import prismadb from "@/lib/prismadb";
import { formatter } from "@/lib/utils";

import { OrderColumn } from "./components/columns";
import { OrderClient } from "./components/client";

const OrdersPage = async ({
  params,
}: {
  params: { storeId: string };
}) => {
  const orders = await prismadb.order.findMany({
    where: {
      storeId: params.storeId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
      shippingDetails: true, // Include shipping details
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedOrders: OrderColumn[] = orders.map((item) => ({
    id: item.id,
    phone: item.shippingDetails?.phoneNumber || "N/A", // Add phone from shipping details
    address: `${item.shippingDetails?.addressLine1 || ""} ${
      item.shippingDetails?.addressLine2 || ""
    }, ${item.shippingDetails?.city || ""}, ${
      item.shippingDetails?.state || ""
    }, ${item.shippingDetails?.zipCode || ""}, ${
      item.shippingDetails?.country || ""
    }`.trim(), // Format full address
    products: item.orderItems
      .map((orderItem) => orderItem.product.name)
      .join(", "), // Convert array to comma-separated string
    quantity: item.orderItems
      .map((orderItem) => `${orderItem.quantity}`)
      .join(", "), // Convert array to comma-separated string
    totalPrice: formatter.format(
      item.orderItems.reduce((total, item) => {
        return total + item.quantity * Number(item.product.price);
      }, 0)
    ),
    isPaid: item.isPaid,
    isSent: item.isSent,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return (
    <main className="flex-col md:ml-56">
      <section className="flex-1 p-8 pt-6 space-y-4">
        <OrderClient data={formattedOrders} />
      </section>
    </main>
  );
};

export default OrdersPage;
