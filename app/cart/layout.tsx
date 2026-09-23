import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function CartLayout({
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
