CREATE TYPE "AcademicPeriodStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

CREATE TABLE "AcademicYear" (
  "id" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AcademicTerm"
  ADD COLUMN "academicYearId" TEXT,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'UPCOMING';

UPDATE "AcademicTerm" SET "status" = 'ACTIVE' WHERE "isActive" = true;

DROP INDEX IF EXISTS "AcademicTerm_collegeId_name_key";
CREATE UNIQUE INDEX "AcademicYear_collegeId_name_key" ON "AcademicYear"("collegeId", "name");
CREATE INDEX "AcademicYear_collegeId_status_idx" ON "AcademicYear"("collegeId", "status");
CREATE UNIQUE INDEX "AcademicTerm_academicYearId_name_key" ON "AcademicTerm"("academicYearId", "name");
CREATE UNIQUE INDEX "AcademicTerm_academicYearId_code_key" ON "AcademicTerm"("academicYearId", "code");
CREATE INDEX "AcademicTerm_collegeId_status_idx" ON "AcademicTerm"("collegeId", "status");

ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
