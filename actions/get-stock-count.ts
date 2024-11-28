import prismadb from "@/lib/prismadb";

export const getStockCount = async (storeId: string) => {
  const products = await prismadb.product.findMany({
    where: {
      storeId,
      isArchived: false,
    },
    include: {
      variants: true, // Include variants to access their `inStock` values
    },
  });

  const totalStockCount = products.reduce((total, product) => {
    const productStock = product.variants.reduce((variantSum, variant) => {
      return variantSum + variant.inStock;
    }, 0);

    return total + productStock;
  }, 0);

  return totalStockCount;
};

