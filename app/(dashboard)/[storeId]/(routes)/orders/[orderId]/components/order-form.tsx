"use client";

import axios from "axios";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Send, Trash } from "lucide-react";
import { format } from "date-fns";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { AlertModal } from "@/components/modals/alert-modal";
import { OrderColumn } from "../../components/columns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  isPaid: z.boolean().default(false),
  status: z.string().optional(),
});

type OrderFormValues = z.infer<typeof formSchema>;

interface OrderFormProps {
  initialData: OrderColumn;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  initialData
}) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const statusColor = {
    PENDING: "bg-yellow-200 text-yellow-700",
    PROCESSING: "bg-blue-200 text-blue-700",
    COMPLETED: "bg-green-200 text-green-700",
    CANCELLED: "bg-red-200 text-red-700",
    FAILED: "bg-red-200 text-red-700",
    REVERSED: "bg-purple-200 text-purple-700"
  };

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isPaid: initialData.isPaid,
    },
  });

  const onSubmit = async (data: OrderFormValues) => {
    try {
      setLoading(true);
      await axios.patch(`/api/${params.storeId}/orders/${params.orderId}`, {
        isPaid: data.isPaid,
        status: data.status || initialData.status
      });
      
      router.refresh();
      router.push(`/${params.storeId}/orders`);
      toast.success("Order updated.");
    } catch (error) {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(
        `/api/${params.storeId}/orders/${initialData.id}`
      );
      router.refresh();
      router.push(`/${params.storeId}/orders`);
      toast.success("Order deleted.");
    } catch (error) {
      toast.error("Something went wrong with this order.");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="container px-4 mx-auto">
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <div className="flex items-center justify-between">
        <Heading
          title="Order details"
          description="More information about specific order"
        />
        <Button
          variant="destructive"
          size="icon"
          onClick={() => setOpen(true)}
          disabled={loading}
        >
          <Trash className="w-4 h-4" />
        </Button>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="p-4 border rounded-md">
          <h2 className="text-lg font-medium">Order Details</h2>
          <div className="mt-4 space-y-2">
            <div>Order ID: {initialData.id}</div>
            <div>Created At: {initialData.createdAt}</div>
            <div>Phone: {initialData.phone}</div>
            <div>Address: {initialData.address}</div>
            <div>Location: {initialData.location}</div>
            <div>Products: {initialData.products}</div>
            <div>Quantity: {initialData.quantity}</div>
            <div>Total Price: {initialData.totalPrice}</div>
            <div>Payment Status: 
              <span className={`ml-2 px-2 py-1 rounded-full text-sm ${
                initialData.isPaid ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
              }`}>
                {initialData.isPaid ? 'Paid' : 'Unpaid'}
              </span>
            </div>
            <div>Order Status: 
              <span className={`ml-2 px-2 py-1 rounded-full text-sm ${
                statusColor[initialData.status as keyof typeof statusColor] || 'bg-gray-200 text-gray-700'
              }`}>
                {initialData.status}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Details Section */}
        {initialData.paymentMethod && (
          <div className="p-4 border rounded-md">
            <h2 className="text-lg font-medium">Payment Details</h2>
            <div className="mt-4 space-y-2">
              <div>Payment Method: {initialData.paymentMethod}</div>
              {initialData.paymentConfirmationCode && (
                <div>Confirmation Code: {initialData.paymentConfirmationCode}</div>
              )}
              {initialData.paymentAccount && (
                <div>Payment Account: {initialData.paymentAccount}</div>
              )}
              {initialData.paymentDescription && (
                <div>Description: {initialData.paymentDescription}</div>
              )}
              {initialData.paymentDate && (
                <div>Payment Date: {format(new Date(initialData.paymentDate), "MMMM do, yyyy HH:mm")}</div>
              )}
            </div>
          </div>
        )}
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-8"
        >
          <div className="grid grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Paid</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button 
              type="button"
              onClick={() => {
                form.setValue("status", "COMPLETED");
                form.handleSubmit(onSubmit)();
              }}
              disabled={loading}
            >
              Mark as Completed
            </Button>
          </div>
          <Button disabled={loading} type="submit">
            Update Order
          </Button>
        </form>
      </Form>
    </div>
  );
};
