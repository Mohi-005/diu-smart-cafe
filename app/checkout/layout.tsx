import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function CheckoutLayout({
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
