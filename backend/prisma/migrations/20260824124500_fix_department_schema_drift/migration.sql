-- AlterTable
ALTER TABLE "PendingStudentEnrollment" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "TimetableVersion" ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "PendingStudentEnrollment" ADD CONSTRAINT "PendingStudentEnrollment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

