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
      shippingDetails: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedOrders: OrderColumn[] = orders.map((item) => ({
    id: item.id,
    phone: item.phone || "N/A",
    address: item.address || "N/A",
    products: item.orderItems
      .map((orderItem) => orderItem.product.name)
      .join(", "),
    quantity: item.orderItems
      .map((orderItem) => `${orderItem.quantity}`)
      .join(", "),
    totalPrice: formatter.format(
      item.orderItems.reduce((total, orderItem) => {
        return total + (orderItem.quantity * Number(orderItem.product.price));
      }, 0)
    ),
    isPaid: item.isPaid,
    status: item.status || "PENDING",
    paymentMethod: item.paymentMethod || "",
    paymentConfirmationCode: item.paymentConfirmationCode || "",
    paymentDescription: item.paymentDescription || "",
    paymentAccount: item.paymentAccount || "",
    paymentDate: item.paymentDate,
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
