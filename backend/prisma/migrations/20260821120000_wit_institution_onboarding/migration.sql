CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InstitutionInvitationRole" AS ENUM ('TEACHER', 'STUDENT');
CREATE TYPE "InstitutionInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
ALTER TYPE "UserRole" ADD VALUE 'COLLEGE_ADMIN';

ALTER TABLE "College"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "shortName" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "status" "InstitutionStatus" NOT NULL DEFAULT 'INACTIVE';

UPDATE "College"
SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')),
    "shortName" = COALESCE("code", "name")
WHERE "slug" IS NULL;

ALTER TABLE "College" ALTER COLUMN "shortName" SET NOT NULL;
ALTER TABLE "College" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "College_slug_key" ON "College"("slug");

INSERT INTO "College" ("id", "name", "code", "slug", "shortName", "city", "state", "country", "status", "createdAt", "updatedAt")
VALUES ('college_wit_solapur', 'Walchand Institute of Technology', 'WIT-SOLAPUR', 'wit-solapur', 'WIT Solapur', 'Solapur', 'Maharashtra', 'India', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "code" = EXCLUDED."code", "slug" = EXCLUDED."slug", "shortName" = EXCLUDED."shortName",
  "city" = EXCLUDED."city", "state" = EXCLUDED."state", "country" = EXCLUDED."country",
  "status" = EXCLUDED."status", "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "InstitutionInvitation" (
  "id" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "InstitutionInvitationRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "InstitutionInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invitedById" TEXT NOT NULL,
  "departmentId" TEXT,
  "academicProgramId" TEXT,
  "classSectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionInvitation_tokenHash_key" ON "InstitutionInvitation"("tokenHash");
CREATE INDEX "InstitutionInvitation_collegeId_status_role_idx" ON "InstitutionInvitation"("collegeId", "status", "role");
CREATE INDEX "InstitutionInvitation_email_status_idx" ON "InstitutionInvitation"("email", "status");
ALTER TABLE "InstitutionInvitation" ADD CONSTRAINT "InstitutionInvitation_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionInvitation" ADD CONSTRAINT "InstitutionInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionInvitation" ADD CONSTRAINT "InstitutionInvitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionInvitation" ADD CONSTRAINT "InstitutionInvitation_academicProgramId_fkey" FOREIGN KEY ("academicProgramId") REFERENCES "AcademicProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionInvitation" ADD CONSTRAINT "InstitutionInvitation_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
