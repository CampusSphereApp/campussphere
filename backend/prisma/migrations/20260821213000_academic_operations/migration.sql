CREATE TYPE "PendingEnrollmentStatus" AS ENUM ('PENDING', 'LINKED', 'CANCELLED');
CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "StudentEnrollment" ADD COLUMN "rollNumber" TEXT;
ALTER TABLE "TeachingAssignment" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TimetableEntry" ADD COLUMN "timetableVersionId" TEXT;

CREATE TABLE "PendingStudentEnrollment" (
  "id" TEXT NOT NULL,
  "collegeId" TEXT NOT NULL,
  "classSectionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "rollNumber" TEXT,
  "status" "PendingEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "linkedUserId" TEXT,
  "linkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PendingStudentEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimetableVersion" (
  "id" TEXT NOT NULL,
  "classSectionId" TEXT NOT NULL,
  "status" "TimetableVersionStatus" NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentEnrollment_classSectionId_rollNumber_key" ON "StudentEnrollment"("classSectionId", "rollNumber");
CREATE UNIQUE INDEX "PendingStudentEnrollment_classSectionId_email_key" ON "PendingStudentEnrollment"("classSectionId", "email");
CREATE UNIQUE INDEX "PendingStudentEnrollment_classSectionId_rollNumber_key" ON "PendingStudentEnrollment"("classSectionId", "rollNumber");
CREATE INDEX "PendingStudentEnrollment_email_status_idx" ON "PendingStudentEnrollment"("email", "status");
CREATE INDEX "PendingStudentEnrollment_collegeId_status_idx" ON "PendingStudentEnrollment"("collegeId", "status");
CREATE UNIQUE INDEX "TimetableVersion_classSectionId_status_key" ON "TimetableVersion"("classSectionId", "status");
CREATE INDEX "TimetableVersion_classSectionId_status_idx" ON "TimetableVersion"("classSectionId", "status");

ALTER TABLE "PendingStudentEnrollment" ADD CONSTRAINT "PendingStudentEnrollment_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingStudentEnrollment" ADD CONSTRAINT "PendingStudentEnrollment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingStudentEnrollment" ADD CONSTRAINT "PendingStudentEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingStudentEnrollment" ADD CONSTRAINT "PendingStudentEnrollment_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_timetableVersionId_fkey" FOREIGN KEY ("timetableVersionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TimetableVersion" ("id", "classSectionId", "status", "publishedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5(cs."id"), cs."id", 'PUBLISHED'::"TimetableVersionStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ClassSection" cs
WHERE EXISTS (
  SELECT 1 FROM "TimetableEntry" te
  JOIN "TeachingAssignment" ta ON ta."id" = te."teachingAssignmentId"
  WHERE ta."classSectionId" = cs."id"
);

UPDATE "TimetableEntry" te
SET "timetableVersionId" = tv."id"
FROM "TeachingAssignment" ta, "TimetableVersion" tv
WHERE te."teachingAssignmentId" = ta."id"
  AND tv."classSectionId" = ta."classSectionId"
  AND tv."status" = 'PUBLISHED';
