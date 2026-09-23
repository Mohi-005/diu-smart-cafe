import StudentRatingGate from "@/components/student/StudentRatingGate";

export default function MenuLayout({
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
