
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

  const osRows = response.externalDataRows || (response.externalDataRow ? [response.externalDataRow] : []);
  if (osRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO CARREGAMENTO (OS)', 15, 92);
    doc.setFont('helvetica', 'normal');
    
    osRows.forEach((row, idx) => {
      const rowY = 98 + (idx * 35);
      if (rowY > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`OS #${idx + 1}: ${row.os}`, 15, rowY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Doca: ${row.doca || '---'} | Veículo: ${row.veiculo || '---'}`, 15, rowY + 5);
      doc.text(`Produto: ${row.cod_produto || ''} ${row.desc_produto || ''}`, 15, rowY + 10);
      doc.text(`Cliente: ${row.cliente}`, 15, rowY + 15);
      doc.text(`Programa: ${row.tipo_programa}`, 15, rowY + 20);
      yPos = rowY + 30;
    });
  }

  if (!template.stages || template.stages.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text("Nenhuma etapa ou resposta encontrada para este checklist.", 15, yPos);
    return doc;
  }

  // Helper to render image grid inline
  const renderImageGrid = async (images: string[], startY: number) => {
    let xPos = 15;
    let currentY = startY;
    const photoSize = 45;
    const margin = 5;

    for (const photoUrl of images) {
      if (!photoUrl || typeof photoUrl !== 'string') continue;
      
      let photo = photoUrl;
      if (!photo.startsWith('data:image')) {
        photo = await getBase64FromUrl(photoUrl);
      }
      
      if (!photo || !photo.startsWith('data:image')) continue;

      if (xPos + photoSize > pageWidth - 15) {
        xPos = 15;
        currentY += photoSize + margin;
      }

      if (currentY + photoSize > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
        xPos = 15;
      }

      try {
        const formatMatch = photo.match(/^data:image\/([a-z]+);base64,/);
        const format = formatMatch ? formatMatch[1].toUpperCase() : 'JPEG';
        
        doc.addImage(photo, format, xPos, currentY, photoSize, photoSize, undefined, 'FAST');
        xPos += photoSize + margin;
      } catch (e) {
        console.error("Erro ao adicionar imagem ao PDF", e);
      }
    }
    return currentY + photoSize + margin;
  };

  for (const stage of template.stages) {
    const stageData = (response.data || {})[stage.id] || {};
    
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Stage Header
    doc.setFillColor(245, 245, 245);
    doc.rect(15, yPos, pageWidth - 30, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(stage.name.toUpperCase(), 20, yPos + 5.5);
    yPos += 12;

    for (const q of stage.questions) {
      const qData = stageData[q.id];
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

      let displayVal = val;
      let signatureImg = '';

      if (q.type === 'SIGNATURE') {
        displayVal = val ? '[Assinado Digitalmente]' : '[Pendente]';
        if (val && typeof val === 'string' && val.startsWith('data:image')) {
          signatureImg = val;
        }
      }
      else if (q.type === 'IMAGE') displayVal = imgs.length > 0 ? `[${imgs.length} Foto(s) Anexada(s)]` : '[Nenhuma Foto]';
      else if (q.type === 'OS') {
        const row = template.externalData?.find(r => r.os === val);
        if (row) {
          displayVal = `OS: ${val}\nDoca: ${row.doca || '---'}\nVeículo: ${row.veiculo || '---'}\nProduto: ${row.cod_produto || ''} ${row.desc_produto || ''}\nCliente: ${row.cliente}`;
        } else {
          displayVal = `OS: ${val || '---'}`;
        }
      }
      else if (Array.isArray(val)) displayVal = val.join(', ');
      else if (val === true) displayVal = 'Sim';
      else if (val === false) displayVal = 'Não';
      else if (val === null || val === undefined || String(val) === 'null' || String(val) === '') displayVal = '---';

      if (q.type !== 'IMAGE' && q.type !== 'SIGNATURE' && imgs.length > 0) {
        displayVal = `${displayVal || '---'} [${imgs.length} Foto(s) Anexada(s)]`;
      }

      const finalNote = note ? `\nObs: ${note}` : '';
      const finalVal = (displayVal === null || displayVal === undefined) ? '---' : displayVal;

      // Render Question Row
      // @ts-ignore
      doc.autoTable({
        startY: yPos,
        body: [[q.text, String(finalVal) + finalNote]],
        theme: 'grid',
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 'auto' } },
        margin: { left: 15, right: 15 },
        styles: { overflow: 'linebreak', cellPadding: 3 },
      });

      // @ts-ignore
      yPos = doc.lastAutoTable.finalY + 2;

      // Render Signature if exists
      if (signatureImg) {
        if (yPos + 30 > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('Assinatura:', 20, yPos + 5);
        try {
          doc.addImage(signatureImg, 'PNG', 20, yPos + 7, 40, 20);
          yPos += 30;
        } catch (e) {
          console.error("Erro ao adicionar assinatura ao PDF", e);
          yPos += 10;
        }
      }

      // Render Images if exist
      if (imgs.length > 0) {
        yPos = await renderImageGrid(imgs, yPos);
        yPos += 5;
      }

      yPos += 2;
    }

    // Add Divergences for this stage
    const stageDivs = response.divergences?.[stage.id] || [];
    if (stageDivs.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28); // Red-700
      doc.text('⚠️ DIVERGÊNCIAS RELATADAS NESTA ETAPA:', 15, yPos);
      yPos += 8;

      for (const div of stageDivs) {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
        
        // Split comment if too long
        const splitComment = doc.splitTextToSize(div.comment, pageWidth - 40);
        doc.text(splitComment, 20, yPos);
        yPos += (splitComment.length * 4) + 2;

        if (div.images.length > 0) {
          yPos = await renderImageGrid(div.images, yPos);
          yPos += 4;
        }

        let otherAttachments = [];
        if (div.videos.length > 0) otherAttachments.push(`${div.videos.length} Vídeo(s)`);
        if (div.files.length > 0) otherAttachments.push(`${div.files.length} Arquivo(s)`);

        if (otherAttachments.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text(`Outros Anexos: ${otherAttachments.join(', ')}`, 25, yPos);
          yPos += 5;
        }
        yPos += 4;
      }
      yPos += 5;
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
