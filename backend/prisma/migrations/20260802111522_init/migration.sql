-- CreateTable
CREATE TABLE "GearList" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gearListId" INTEGER NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_gearListId_fkey" FOREIGN KEY ("gearListId") REFERENCES "GearList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
