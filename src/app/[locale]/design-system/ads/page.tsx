import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("ads");
}

export default function Page() {
  return <LabBoardPage board="ads" />;
}
