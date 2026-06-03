import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const tanuki = await prisma.user.upsert({
    where: { email: 'tanuki@splitr.app' },
    update: {},
    create: {
      email: 'tanuki@splitr.app',
      name: 'Tanuki',
      password: await bcrypt.hash('password123', 10),
      color: '#c8f060',
    },
  })

  const fox = await prisma.user.upsert({
    where: { email: 'fox@splitr.app' },
    update: {},
    create: {
      email: 'fox@splitr.app',
      name: 'Fox',
      password: await bcrypt.hash('password123', 10),
      color: '#85b7eb',
    },
  })

  const group = await prisma.group.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Foyer',
      currency: 'EUR',
    },
  })

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: tanuki.id, groupId: group.id } },
    update: {},
    create: { userId: tanuki.id, groupId: group.id, role: 'owner' },
  })

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: fox.id, groupId: group.id } },
    update: {},
    create: { userId: fox.id, groupId: group.id, role: 'member' },
  })

  console.log('Seed OK — Tanuki:', tanuki.id, '/ Fox:', fox.id, '/ Group:', group.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
