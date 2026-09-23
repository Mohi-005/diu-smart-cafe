import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function PaymentLayout({
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
