import prismadb from "@/lib/prismadb";
import { OrderForm } from "./components/order-form";
import { OrderColumn } from "../components/columns";
import { formatter } from "@/lib/utils";
import { format } from "date-fns";

const OrderPage = async ({
  params,
}: {
  params: { orderId: string };
}) => {
  const order = await prismadb.order.findUnique({
    where: {
      id: params.orderId,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    return <div>Order not found</div>;
  }

  const formattedOrder: OrderColumn = {
    id: order.id,
    phone: order.phone || "",
    address: order.address || "",
    location: order.location || "",
    products: order.orderItems
      .map((orderItem) => orderItem.product.name)
      .join(", "),
    quantity: order.orderItems
      .map((orderItem) => orderItem.quantity.toString())
      .join(", "),
    totalPrice: formatter.format(
      order.orderItems.reduce((total, item) => {
        return total + (Number(item.product.price) * item.quantity);
      }, 0)
    ),
    isPaid: order.isPaid,
    status: order.status,
    paymentMethod: order.paymentMethod || "",
    paymentConfirmationCode: order.paymentConfirmationCode || "",
    paymentDescription: order.paymentDescription || "",
    paymentAccount: order.paymentAccount || "",
    paymentDate: order.paymentDate,
    createdAt: format(order.createdAt, "MMMM do, yyyy"),
  };

  return (
    <div className="flex-col md:ml-56">
      <div className="flex-1 p-8 pt-6 space-y-4">
        <OrderForm initialData={formattedOrder} />
      </div>
    </div>
  );
};

export default OrderPage;
