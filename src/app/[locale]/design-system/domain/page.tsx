import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("domain");
}

export default function Page() {
  return <LabBoardPage board="domain" />;
}
