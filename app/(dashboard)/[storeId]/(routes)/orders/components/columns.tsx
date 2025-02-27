"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { ArrowUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface OrderColumn {
  id: string;
  phone: string;
  address: string; // This will display as "Shipping Address"
  products: string; // Product name
  quantity: string; // Quantity as a string from your data
  totalPrice: string;
  isPaid: boolean;
  status: string; // Add status field
  paymentMethod?: string; // Add new payment fields
  paymentConfirmationCode?: string;
  paymentDescription?: string;
  paymentAccount?: string;
  paymentDate?: Date;
  createdAt: string;
}

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
    accessorKey: "status",
    header: "Status",
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
