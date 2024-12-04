import prismadb from "@/lib/prismadb";

export const getStockCount = async (storeId: string) => {
  const products = await prismadb.product.findMany({
    where: {
      storeId,
      isArchived: false,
    },
  });

  const totalStockCount = products.reduce((total, product) => {
    return total + (product.inStock || 0);
  }, 0);

  return totalStockCount;
};
