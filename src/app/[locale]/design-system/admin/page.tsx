import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("admin");
}

export default function Page() {
  return <LabBoardPage board="admin" />;
}
