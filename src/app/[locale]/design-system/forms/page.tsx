import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("forms");
}

export default function Page() {
  return <LabBoardPage board="forms" />;
}
