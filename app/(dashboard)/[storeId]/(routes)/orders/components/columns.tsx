"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { ArrowUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type OrderColumn = {
  id: string;
  phone: string;
  address: string; // This will display as "Shipping Address"
  products: string; // Product name
  quantity: string; // Quantity as a string from your data
  totalPrice: string;
  isPaid: boolean;
  isSent: boolean;
  createdAt: string;
};

export const columns: ColumnDef<OrderColumn>[] = [
  {
    accessorKey: "products", // Access the product name
    header: "Product Name",
    cell: ({ row }) => {
      return <div>{row.getValue("products")}</div>;
    },
  },
  {
    accessorKey: "quantity", // Access the quantity
    header: "Quantity",
    cell: ({ row }) => {
      return <div>{row.getValue("quantity")}</div>;
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "address", // Field remains as "address"
    header: "Shipping Address", // Display name updated
  },
  {
    accessorKey: "totalPrice",
    header: "Total Price",
  },
  {
    accessorKey: "isPaid",
    header: "Paid",
    cell: ({ row }) => {
      return row.getValue("isPaid") ? <Check /> : <X />;
    },
  },
  {
    accessorKey: "isSent",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const isPaid = row.getValue("isPaid");
      const isSent = row.getValue("isSent");
      if (!isPaid) return <Badge variant="destructive">Processing</Badge>;
      return isSent ? (
        <Badge variant="success">Sent</Badge>
      ) : (
        <Badge variant="warning">Pending</Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Order Date",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
