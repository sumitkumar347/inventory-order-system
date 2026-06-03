require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const bcrypt = require('bcryptjs');

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in the environment variables.');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Start seeding...');

  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Cleared existing records.');

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const sellerPasswordHash = await bcrypt.hash('seller123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@inventory.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const seller = await prisma.user.create({
    data: {
      email: 'seller@inventory.com',
      passwordHash: sellerPasswordHash,
      role: 'SELLER',
    },
  });

  console.log(`Seeded users: admin (${admin.email}), seller (${seller.email})`);

  const productsData = [
    {
      name: 'Premium Basmati Rice',
      sku: 'RICE-BAS-001',
      description: 'Long grain aromatic premium basmati rice.',
      category: 'Grains',
      baseUnit: 'kg',
      basePrice: 80.0000,
      stockQuantity: 1500.0000,
    },
    {
      name: 'Sugar (Fine Grain)',
      sku: 'SUG-FINE-002',
      description: 'Refined high-purity white sugar.',
      category: 'Pantry',
      baseUnit: 'kg',
      basePrice: 46.5000,
      stockQuantity: 2000.0000,
    },
    {
      name: 'Organic Wild Honey',
      sku: 'HONEY-WLD-003',
      description: 'Pure forest organic wild honey stored in grams.',
      category: 'Pantry',
      baseUnit: 'g',
      basePrice: 0.6500,
      stockQuantity: 50000.0000,
    },
    {
      name: 'Refined Sunflower Oil',
      sku: 'OIL-SUN-004',
      description: 'Healthy cooking oil high in Vitamin E.',
      category: 'Cooking Oils',
      baseUnit: 'L',
      basePrice: 135.0000,
      stockQuantity: 400.0000,
    },
    {
      name: 'Full Cream Dairy Milk',
      sku: 'MILK-FC-005',
      description: 'Fresh pasteurized full cream milk stored in milliliters.',
      category: 'Dairy',
      baseUnit: 'mL',
      basePrice: 0.0760,
      stockQuantity: 120000.0000,
    },
    {
      name: 'Steel Kitchen Chef Knife',
      sku: 'KNIFE-STL-006',
      description: '8-inch stainless steel professional chefs knife.',
      category: 'Kitchenware',
      baseUnit: 'item',
      basePrice: 380.0000,
      stockQuantity: 45.0000,
    },
    {
      name: 'Microfiber Cleaning Cloth',
      sku: 'CLOTH-MC-007',
      description: 'Soft absorbent reusable microfiber cloth.',
      category: 'Household',
      baseUnit: 'item',
      basePrice: 55.0000,
      stockQuantity: 300.0000,
    },
  ];

  for (const product of productsData) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log(`Seeded ${productsData.length} products with diverse units.`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
