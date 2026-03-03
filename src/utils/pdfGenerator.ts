
import { ChecklistResponse, ChecklistTemplate } from '../types';

export const generateChecklistPDF = (response: ChecklistResponse, template: ChecklistTemplate) => {
  // @ts-ignore
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(234, 88, 12); // Orange 600
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('CheckTopLog', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE INSPEÇÃO OPERACIONAL', 15, 33);

  // Info Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Modelo: ${template.title}`, 15, 55);
  doc.text(`Identificação: ${response.customId}`, 15, 62);
  doc.text(`Data/Hora: ${new Date(response.updatedAt).toLocaleString('pt-BR')}`, 15, 69);
  doc.text(`Status: ${response.status === 'COMPLETED' ? 'CONCLUÍDO' : 'RASCUNHO'}`, 15, 76);

  let yPos = 85;

    const allImages: { label: string, data: string[] }[] = [];

    template.stages.forEach((stage) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, pageWidth - 30, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text(stage.name.toUpperCase(), 20, yPos + 5.5);
      yPos += 12;

      const tableData = stage.questions.map((q) => {
        const qData = response.data[stage.id]?.[q.id];
        const val = (qData && typeof qData === 'object' && 'val' in qData) ? qData.val : (qData || null);
        const imgs = (qData && typeof qData === 'object' && qData.imgs) ? qData.imgs : [];
        
        if (imgs.length > 0) {
          allImages.push({ label: q.text, data: imgs });
        }

        let displayVal = val;
        if (q.type === 'SIGNATURE') displayVal = val ? '[Assinado Digitalmente]' : '[Pendente]';
        else if (q.type === 'IMAGE') displayVal = imgs.length > 0 ? `[${imgs.length} Foto(s) Anexada(s)]` : '[Nenhuma Foto]';
        else if (Array.isArray(val)) displayVal = val.join(', ');
        else if (val === true) displayVal = 'Sim';
        else if (val === false) displayVal = 'Não';
        else if (val === null || val === undefined || val === 'null') displayVal = '---';

        // If it's not an IMAGE type but has photos attached, mention it
        if (q.type !== 'IMAGE' && imgs.length > 0) {
          displayVal = `${displayVal || '---'} [${imgs.length} Foto(s) Anexada(s)]`;
        }

        const note = (qData && typeof qData === 'object' && qData.note) ? `\nObs: ${qData.note}` : '';
        const finalVal = displayVal === null || displayVal === undefined || displayVal === 'null' ? '---' : displayVal;

        return [q.text, String(finalVal) + note];
      });

      // @ts-ignore
      doc.autoTable({
        startY: yPos,
        head: [['Campo', 'Resposta']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
        margin: { left: 15, right: 15 },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y;
        }
      });

      // @ts-ignore
      yPos = doc.lastAutoTable.finalY + 10;
    });

    // Add Images Section
    if (allImages.length > 0) {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      } else {
        yPos += 5;
      }

      doc.setFillColor(234, 88, 12);
      doc.rect(15, yPos, pageWidth - 30, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('FOTOS ANEXADAS', 20, yPos + 5.5);
      yPos += 15;

      allImages.forEach((imgGroup) => {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(imgGroup.label.toUpperCase(), 15, yPos);
        yPos += 5;

        let xPos = 15;
        const photoSize = 55;

        imgGroup.data.forEach((photo) => {
          if (xPos + photoSize > pageWidth - 15) {
            xPos = 15;
            yPos += photoSize + 5;
          }

          if (yPos + photoSize > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPos = 20;
            xPos = 15;
          }

          try {
            doc.addImage(photo, 'JPEG', xPos, yPos, photoSize, photoSize);
            xPos += photoSize + 5;
          } catch (e) {
            console.error("Erro ao adicionar imagem ao PDF", e);
          }
        });

        yPos += photoSize + 15;
      });
    }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount} - Gerado por CheckTopLog`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  return doc;
};
