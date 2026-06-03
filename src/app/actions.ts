'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSessionToken, verifySessionToken } from '@/lib/auth';
import { calculateOrderPrice, areUnitsCompatible } from '@/utils/conversions';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (error) {
    return null;
  }
}

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { error: 'Invalid email or password.' };
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return { error: 'Invalid email or password.' };
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return { success: true, role: user.role };
  } catch (error: any) {
    console.error('Login action error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'Logout failed.' };
  }
}

export async function getProductsAction(query?: string, category?: string) {
  try {
    const whereClause: Prisma.ProductWhereInput = { status: 'active' };

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      products: products.map(p => ({
        ...p,
        basePrice: p.basePrice.toString(),
        stockQuantity: p.stockQuantity.toString(),
      })),
    };
  } catch (error: any) {
    console.error('Fetch products error:', error);
    return { error: 'Failed to retrieve products.' };
  }
}

export async function createProductAction(data: {
  name: string;
  sku: string;
  description?: string;
  category: string;
  baseUnit: string;
  basePrice: string;
  stockQuantity: string;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku.toUpperCase(),
        description: data.description,
        category: data.category,
        baseUnit: data.baseUnit,
        basePrice: new Prisma.Decimal(data.basePrice),
        stockQuantity: new Prisma.Decimal(data.stockQuantity),
      },
    });

    return { success: true, product: { ...product, basePrice: product.basePrice.toString(), stockQuantity: product.stockQuantity.toString() } };
  } catch (error: any) {
    console.error('Create product error:', error);
    if (error.code === 'P2002') {
      return { error: 'A product with this SKU already exists.' };
    }
    return { error: 'Failed to create product.' };
  }
}

export async function updateProductAction(
  id: string,
  data: {
    name: string;
    sku: string;
    description?: string;
    category: string;
    baseUnit: string;
    basePrice: string;
    stockQuantity: string;
  }
) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        sku: data.sku.toUpperCase(),
        description: data.description,
        category: data.category,
        baseUnit: data.baseUnit,
        basePrice: new Prisma.Decimal(data.basePrice),
        stockQuantity: new Prisma.Decimal(data.stockQuantity),
      },
    });

    return { success: true, product: { ...product, basePrice: product.basePrice.toString(), stockQuantity: product.stockQuantity.toString() } };
  } catch (error: any) {
    console.error('Update product error:', error);
    if (error.code === 'P2002') {
      return { error: 'A product with this SKU already exists.' };
    }
    return { error: 'Failed to update product.' };
  }
}

export async function deleteProductAction(id: string) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    await prisma.product.update({
      where: { id },
      data: { status: 'inactive' },
    });
    return { success: true };
  } catch (error) {
    console.error('Delete product error:', error);
    return { error: 'Failed to delete product.' };
  }
}

export async function placeOrderAction(items: Array<{
  productId: string;
  orderedQuantity: string;
  orderedUnit: string;
}>) {
  const user = await getSessionUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  if (items.length === 0) {
    return { error: 'Cannot place an empty order.' };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      let orderTotal = new Decimal(0);
      const itemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || product.status !== 'active') {
          throw new Error(`Product not found or inactive.`);
        }

        if (!areUnitsCompatible(item.orderedUnit, product.baseUnit)) {
          throw new Error(`Incompatible units for product ${product.name}. Selected: ${item.orderedUnit}, Base: ${product.baseUnit}`);
        }

        const { conversionFactor, baseQuantity, calculatedPrice } = calculateOrderPrice(
          item.orderedQuantity,
          item.orderedUnit,
          product.baseUnit,
          product.basePrice.toString()
        );

        const currentStock = new Decimal(product.stockQuantity.toString());
        if (baseQuantity.gt(currentStock)) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock.toString()} ${product.baseUnit}, Requested: ${baseQuantity.toString()} ${product.baseUnit}.`);
        }

        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: {
              decrement: new Prisma.Decimal(baseQuantity.toString()),
            },
          },
        });

        orderTotal = orderTotal.plus(calculatedPrice);

        itemsToCreate.push({
          productId: product.id,
          orderedQuantity: new Prisma.Decimal(item.orderedQuantity),
          orderedUnit: item.orderedUnit,
          conversionFactor: new Prisma.Decimal(conversionFactor.toString()),
          unitPrice: product.basePrice,
          calculatedPrice: new Prisma.Decimal(calculatedPrice.toString()),
        });
      }

      const order = await tx.order.create({
        data: {
          userId: user.id,
          totalAmount: new Prisma.Decimal(orderTotal.toString()),
          status: 'PENDING',
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      return {
        success: true,
        orderId: order.id,
        totalAmount: order.totalAmount.toString(),
      };
    });
  } catch (error: any) {
    console.error('Order placement transaction error:', error);
    return { error: error.message || 'Failed to place order. Inventory checking failed.' };
  }
}

export async function getOrdersAction() {
  const user = await getSessionUser();
  if (!user) {
    return { error: 'Unauthorized.' };
  }

  try {
    const whereClause = user.role === 'ADMIN' ? {} : { userId: user.id };

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        user: { select: { email: true } },
        items: {
          include: {
            product: {
              select: { name: true, sku: true, baseUnit: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      orders: orders.map(order => ({
        ...order,
        totalAmount: order.totalAmount.toString(),
        items: order.items.map(item => ({
          ...item,
          orderedQuantity: item.orderedQuantity.toString(),
          conversionFactor: item.conversionFactor.toString(),
          unitPrice: item.unitPrice.toString(),
          calculatedPrice: item.calculatedPrice.toString(),
        })),
      })),
    };
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return { error: 'Failed to retrieve orders.' };
  }
}

export async function updateOrderStatusAction(orderId: string, status: 'APPROVED' | 'REJECTED') {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Unauthorized.' };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new Error('Order not found.');
      }

      if (order.status !== 'PENDING') {
        throw new Error(`Order is already ${order.status}. Status cannot be modified.`);
      }

      if (status === 'REJECTED') {
        for (const item of order.items) {
          const baseQuantity = new Decimal(item.orderedQuantity.toString())
            .times(new Decimal(item.conversionFactor.toString()));

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                increment: new Prisma.Decimal(baseQuantity.toString()),
              },
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      return { success: true, status: updatedOrder.status };
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return { error: error.message || 'Failed to update order status.' };
  }
}

export async function getProductCategoriesAction() {
  try {
    const categories = await prisma.product.findMany({
      where: { status: 'active' },
      select: { category: true },
      distinct: ['category'],
    });
    return { success: true, categories: categories.map(c => c.category) };
  } catch (error) {
    console.error('Get categories error:', error);
    return { error: 'Failed to fetch categories.' };
  }
}
