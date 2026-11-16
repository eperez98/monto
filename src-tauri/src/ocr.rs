//! Reads the text of a receipt photo with the OCR built into Windows. Runs on this computer only:
//! the image never leaves it and nothing is downloaded.

#[cfg(windows)]
fn recognize(bytes: &[u8]) -> windows::core::Result<Vec<String>> {
    use windows::Graphics::Imaging::{BitmapAlphaMode, BitmapDecoder, BitmapInterpolationMode, BitmapPixelFormat, BitmapTransform, ColorManagementMode, ExifOrientationMode};
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

    let stream = InMemoryRandomAccessStream::new()?;
    let writer = DataWriter::CreateDataWriter(&stream)?;
    writer.WriteBytes(bytes)?;
    writer.StoreAsync()?.join()?;
    writer.DetachStream()?;
    stream.Seek(0)?;
    let decoder = BitmapDecoder::CreateAsync(&stream)?.join()?;

    // Windows OCR rejects images larger than MaxImageDimension, and phone photos usually are.
    let (w, h) = (decoder.OrientedPixelWidth()?, decoder.OrientedPixelHeight()?);
    let max = OcrEngine::MaxImageDimension()?;
    let transform = BitmapTransform::new()?;
    if w.max(h) > max {
        let k = max as f64 / w.max(h) as f64;
        transform.SetScaledWidth((decoder.PixelWidth()? as f64 * k) as u32)?;
        transform.SetScaledHeight((decoder.PixelHeight()? as f64 * k) as u32)?;
        transform.SetInterpolationMode(BitmapInterpolationMode::Fant)?;
    }
    let bitmap = decoder
        .GetSoftwareBitmapTransformedAsync(BitmapPixelFormat::Bgra8, BitmapAlphaMode::Premultiplied, &transform, ExifOrientationMode::RespectExifOrientation, ColorManagementMode::DoNotColorManage)?
        .join()?;
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()?;
    let result = engine.RecognizeAsync(&bitmap)?.join()?;
    let mut found = Vec::new();
    for line in result.Lines()? {
        let r = line.Words()?.GetAt(0)?.BoundingRect()?;
        found.push((r.X, r.Y + r.Height / 2.0, r.Height, line.Text()?.to_string()));
    }
    Ok(rows(found))
}

/// Windows returns a receipt's columns as separate lines ("TOTAL" and "9.10"); join the pieces
/// that sit on the same row, left to right, so a label stays next to its amount.
#[cfg_attr(not(windows), allow(dead_code))]
fn rows(mut found: Vec<(f32, f32, f32, String)>) -> Vec<String> {
    found.sort_by(|a, b| a.1.total_cmp(&b.1));
    let mut out: Vec<(f32, f32, Vec<(f32, String)>)> = Vec::new();
    for (x, y, h, text) in found {
        match out.last_mut() {
            Some(row) if (y - row.0).abs() < row.1.max(h) * 0.5 => row.2.push((x, text)),
            _ => out.push((y, h, vec![(x, text)])),
        }
    }
    out.into_iter()
        .map(|(_, _, mut parts)| {
            parts.sort_by(|a, b| a.0.total_cmp(&b.0));
            parts.into_iter().map(|p| p.1).collect::<Vec<_>>().join(" ")
        })
        .collect()
}

/// Returns the receipt's text, one entry per line.
#[tauri::command]
pub async fn read_receipt(image: Vec<u8>) -> Result<Vec<String>, String> {
    if image.is_empty() || image.len() > 10 * 1024 * 1024 {
        return Err("La imagen debe pesar menos de 10 MB.".into());
    }
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || recognize(&image).map_err(|e| format!("No se pudo leer la imagen: {}", e.message())))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = image;
        Err("Leer comprobantes solo está disponible en Windows.".into())
    }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn reads_a_receipt_with_windows_ocr() {
        let lines = super::recognize(include_bytes!("../fixtures/receipt.png")).expect("Windows OCR");
        let text = lines.join("\n").to_uppercase();
        println!("{text}");
        assert!(text.contains("SUPER 99"), "{text}");
        assert!(text.lines().any(|l| l.starts_with("TOTAL") && l.ends_with("9.10")), "{text}");
    }

    #[test]
    fn joins_columns_on_the_same_row() {
        let got = super::rows(vec![(400.0, 101.0, 20.0, "9.10".into()), (10.0, 50.0, 20.0, "SUPER".into()), (10.0, 100.0, 20.0, "TOTAL".into())]);
        assert_eq!(got, vec!["SUPER", "TOTAL 9.10"]);
    }
}
