declare module "jspdf-autotable" {
  import { jsPDF } from "jspdf";
  export default function autoTable(doc: jsPDF, options: any): void;
}

declare module "file-saver" {
  export function saveAs(data: Blob, filename: string): void;
}
