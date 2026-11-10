import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("crm");
}

export default function Page() {
  return <LabBoardPage board="crm" />;
}
