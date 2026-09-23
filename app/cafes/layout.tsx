import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function CafesLayout({
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
