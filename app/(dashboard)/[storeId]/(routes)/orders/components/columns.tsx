"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";
import { ArrowUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type OrderColumn = {
  id: string;
  phone: string;
  address: string;
  isPaid: boolean;
  isSent: boolean;
  totalPrice: string;
  products: { name: string; quantity: number }[] | string; // Supports both parsed and string formats
  createdAt: string;
};

export const columns: ColumnDef<OrderColumn>[] = [
  {
    accessorKey: "products",
    header: "Products",
    cell: ({ row }) => {
      // Handle parsed or string data
      let products: { name: string; quantity: number }[] = [];
      try {
        const rawProducts = row.getValue("products");
        products =
          typeof rawProducts === "string" ? JSON.parse(rawProducts) : rawProducts;
      } catch (error) {
        console.error("Error parsing products:", error);
      }

      if (!Array.isArray(products)) {
        return <div>No products available</div>;
      }

      return (
        <>
          {products.map((product, index) => (
            <div key={index}>
              {product.name} x {product.quantity}
            </div>
          ))}
        </>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "address",
    header: "Address",
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
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
