-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "LectureType" AS ENUM ('LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR');

-- AlterTable
ALTER TABLE "ClassSection" ADD COLUMN     "createdByTeacherId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "createdByTeacherId" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "TeacherClassAccess" (
    "teacherId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "canManage" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherClassAccess_pkey" PRIMARY KEY ("teacherId","classSectionId")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "room" TEXT,
    "lectureType" "LectureType" NOT NULL DEFAULT 'LECTURE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherClassAccess_classSectionId_idx" ON "TeacherClassAccess"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableEntry_teachingAssignmentId_day_startMinutes_idx" ON "TimetableEntry"("teachingAssignmentId", "day", "startMinutes");

-- AddForeignKey
ALTER TABLE "ClassSection" ADD CONSTRAINT "ClassSection_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClassAccess" ADD CONSTRAINT "TeacherClassAccess_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherClassAccess" ADD CONSTRAINT "TeacherClassAccess_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
