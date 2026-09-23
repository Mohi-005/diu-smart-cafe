import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <StudentRatingGate />
    </>
  );
}
