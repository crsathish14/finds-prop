import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("seller");
}

export default function Page() {
  return <LabBoardPage board="seller" />;
}
