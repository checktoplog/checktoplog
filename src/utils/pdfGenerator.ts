
import { ChecklistResponse, ChecklistTemplate } from '../types';

export const generateChecklistPDF = async (response: ChecklistResponse, template: ChecklistTemplate) => {
  // @ts-ignore
  const jspdfLib = window.jspdf;
  if (!jspdfLib) {
    console.error("jsPDF library not found on window.jspdf");
    throw new Error("Biblioteca de geração de PDF não encontrada.");
  }
  
  const { jsPDF } = jspdfLib;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Helper to convert URL to base64
  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:image')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error fetching image for PDF:", url, e);
      return '';
    }
  };

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
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES GERAIS', 15, 50);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Modelo: ${template.title || 'N/A'}`, 15, 58);
  doc.text(`Identificação: ${response.customId || 'N/A'}`, 15, 64);
  
  const dateStr = response.updatedAt ? new Date(response.updatedAt).toLocaleString('pt-BR') : 'N/A';
  doc.text(`Data/Hora: ${dateStr}`, 15, 70);
  doc.text(`Status: ${response.status === 'COMPLETED' ? 'CONCLUÍDO' : 'RASCUNHO'}`, 15, 76);
  doc.text(`ID do Registro: ${response.id}`, 15, 82);

  let yPos = 95;

  if (response.externalDataRow) {
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CARREGAMENTO (OS)', 15, 92);
    doc.setFont('helvetica', 'normal');
    doc.text(`OS: ${response.externalDataRow.os}`, 15, 98);
    doc.text(`Doca: ${response.externalDataRow.doca || '---'}`, 15, 104);
    doc.text(`Veículo: ${response.externalDataRow.veiculo || '---'}`, 15, 110);
    doc.text(`Produto: ${response.externalDataRow.cod_produto || ''} ${response.externalDataRow.desc_produto || ''}`, 15, 116);
    doc.text(`Cliente: ${response.externalDataRow.cliente}`, 15, 122);
    doc.text(`Programa: ${response.externalDataRow.tipo_programa}`, 15, 128);
    yPos = 140;
  }

  if (!template.stages || template.stages.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text("Nenhuma etapa ou resposta encontrada para este checklist.", 15, yPos);
    return doc;
  }

    const allImages: { label: string, data: string[] }[] = [];

    template.stages.forEach((stage) => {
      // Get questions for this stage that have data
      const stageData = (response.data || {})[stage.id] || {};
      
      const tableData = stage.questions.map((q) => {
        const qData = stageData[q.id];
        
        // Extract value and images safely
        let val: any = null;
        let imgs: string[] = [];
        let note = '';

        if (qData && typeof qData === 'object') {
          val = 'val' in qData ? qData.val : qData;
          imgs = qData.imgs || [];
          note = qData.note || '';
        } else {
          val = qData;
        }
        
        if (imgs.length > 0) {
          allImages.push({ label: q.text, data: imgs });
        }

        let displayVal = val;
        if (q.type === 'SIGNATURE') {
          displayVal = val ? '[Assinado Digitalmente]' : '[Pendente]';
          if (val && typeof val === 'string' && val.startsWith('data:image')) {
            allImages.push({ label: `Assinatura: ${q.text}`, data: [val] });
          }
        }
        else if (q.type === 'IMAGE') displayVal = imgs.length > 0 ? `[${imgs.length} Foto(s) Anexada(s)]` : '[Nenhuma Foto]';
        else if (Array.isArray(val)) displayVal = val.join(', ');
        else if (val === true) displayVal = 'Sim';
        else if (val === false) displayVal = 'Não';
        else if (val === null || val === undefined || String(val) === 'null' || String(val) === '') displayVal = '---';

        // If it's not an IMAGE type but has photos attached, mention it
        if (q.type !== 'IMAGE' && q.type !== 'SIGNATURE' && imgs.length > 0) {
          displayVal = `${displayVal || '---'} [${imgs.length} Foto(s) Anexada(s)]`;
        }

        const finalNote = note ? `\nObs: ${note}` : '';
        const finalVal = (displayVal === null || displayVal === undefined) ? '---' : displayVal;

        return [q.text, String(finalVal) + finalNote];
      });

      if (tableData.length > 0) {
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
        yPos += 10;

        // @ts-ignore
        doc.autoTable({
          startY: yPos,
          head: [['Campo', 'Resposta']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [60, 60, 60], fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
          columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
          margin: { left: 15, right: 15 },
          styles: { overflow: 'linebreak', cellPadding: 3 },
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 10;
      }
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

      for (const imgGroup of allImages) {
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

        for (const photoUrl of imgGroup.data) {
          if (!photoUrl || typeof photoUrl !== 'string') continue;
          
          let photo = photoUrl;
          if (!photo.startsWith('data:image')) {
            photo = await getBase64FromUrl(photoUrl);
          }
          
          if (!photo || !photo.startsWith('data:image')) continue;

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
            const formatMatch = photo.match(/^data:image\/([a-z]+);base64,/);
            const format = formatMatch ? formatMatch[1].toUpperCase() : 'JPEG';
            
            doc.addImage(photo, format, xPos, yPos, photoSize, photoSize, undefined, 'FAST');
            xPos += photoSize + 5;
          } catch (e) {
            console.error("Erro ao adicionar imagem ao PDF", e);
          }
        }

        yPos += photoSize + 15;
      }
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
