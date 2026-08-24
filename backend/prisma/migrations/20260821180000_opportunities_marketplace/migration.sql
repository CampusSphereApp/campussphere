-- CreateEnum
CREATE TYPE "OpportunityListingStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityWorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE');

-- CreateEnum
CREATE TYPE "OpportunityCommitment" AS ENUM ('ONE_TIME', 'SHORT_TERM', 'ONGOING');

-- CreateEnum
CREATE TYPE "OpportunityCompensation" AS ENUM ('PAID', 'UNPAID', 'TO_BE_DISCUSSED');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('IDEA', 'PROTOTYPE', 'WORKING_PRODUCT', 'EARLY_STARTUP');

-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS', 'PRIVATE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'SHORTLISTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_APPLICATION_UPDATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OpportunityType" ADD VALUE 'BUILD_WITH_ME';
ALTER TYPE "OpportunityType" ADD VALUE 'PROJECT_COLLABORATION';
ALTER TYPE "OpportunityType" ADD VALUE 'STARTUP_ROLE';
ALTER TYPE "OpportunityType" ADD VALUE 'FREELANCE';
ALTER TYPE "OpportunityType" ADD VALUE 'PART_TIME';
ALTER TYPE "OpportunityType" ADD VALUE 'RESEARCH';
ALTER TYPE "OpportunityType" ADD VALUE 'CAMPUS_WORK';
ALTER TYPE "OpportunityType" ADD VALUE 'VOLUNTEER';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "commitment" "OpportunityCommitment" NOT NULL DEFAULT 'SHORT_TERM',
ADD COLUMN     "compensationDetails" TEXT,
ADD COLUMN     "compensationType" "OpportunityCompensation" NOT NULL DEFAULT 'TO_BE_DISCUSSED',
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "helpNeeded" TEXT,
ADD COLUMN     "peopleNeeded" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "preferredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relatedProjectId" TEXT,
ADD COLUMN     "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stage" "OpportunityStage",
ADD COLUMN     "status" "OpportunityListingStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "workMode" "OpportunityWorkMode" NOT NULL DEFAULT 'REMOTE',
ALTER COLUMN "organization" DROP NOT NULL,
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "applicationUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "detailedDescription" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "userRole" TEXT,
ADD COLUMN     "visibility" "ProjectVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "OpportunityApplication" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "contribution" TEXT NOT NULL,
    "relevantSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationProject" (
    "applicationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ApplicationProject_pkey" PRIMARY KEY ("applicationId","projectId")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("userId","opportunityId")
);

-- CreateTable
CREATE TABLE "OpportunityReport" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityApplication_opportunityId_status_idx" ON "OpportunityApplication"("opportunityId", "status");

-- CreateIndex
CREATE INDEX "OpportunityApplication_applicantId_status_idx" ON "OpportunityApplication"("applicantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityApplication_opportunityId_applicantId_key" ON "OpportunityApplication"("opportunityId", "applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityReport_opportunityId_reporterId_key" ON "OpportunityReport"("opportunityId", "reporterId");

-- CreateIndex
CREATE INDEX "Opportunity_status_createdAt_idx" ON "Opportunity"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_createdBy_status_idx" ON "Opportunity"("createdBy", "status");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_relatedProjectId_fkey" FOREIGN KEY ("relatedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityApplication" ADD CONSTRAINT "OpportunityApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationProject" ADD CONSTRAINT "ApplicationProject_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OpportunityApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationProject" ADD CONSTRAINT "ApplicationProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityReport" ADD CONSTRAINT "OpportunityReport_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityReport" ADD CONSTRAINT "OpportunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
