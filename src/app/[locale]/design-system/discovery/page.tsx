import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("discovery");
}

export default function Page() {
  return <LabBoardPage board="discovery" />;
}
