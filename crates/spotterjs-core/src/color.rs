use crate::capture::capture_screen;
use crate::error::{Result, SpotterError};
use crate::types::{Point, Region, Rgb, RgbaImage};
use std::thread;
use std::time::{Duration, Instant};

pub fn color_within(actual: Rgb, target: Rgb, tolerance: u8) -> bool {
    actual.r.abs_diff(target.r) <= tolerance
        && actual.g.abs_diff(target.g) <= tolerance
        && actual.b.abs_diff(target.b) <= tolerance
}

pub fn pixel_color(image: &RgbaImage, x: u32, y: u32) -> Result<Rgb> {
    if x >= image.width || y >= image.height {
        return Err(SpotterError::Image(format!(
            "pixel out of bounds: ({x},{y}) for {}x{} image",
            image.width, image.height
        )));
    }
    let expected = (image.width * image.height * 4) as usize;
    if image.data.len() != expected {
        return Err(SpotterError::Image("invalid RGBA buffer length".into()));
    }
    let offset = ((y * image.width + x) * 4) as usize;
    Ok(Rgb {
        r: image.data[offset],
        g: image.data[offset + 1],
        b: image.data[offset + 2],
    })
}

pub fn get_pixel_color(x: i32, y: i32) -> Result<Rgb> {
    let image = capture_screen(Some(Region {
        left: x,
        top: y,
        width: 1,
        height: 1,
    }))?;
    pixel_color(&image, 0, 0)
}

pub fn find_color_in_image(
    image: &RgbaImage,
    target: Rgb,
    tolerance: u8,
    origin_x: i32,
    origin_y: i32,
) -> Result<Option<Point>> {
    Ok(
        find_all_color_in_image(image, target, tolerance, origin_x, origin_y)?
            .into_iter()
            .next(),
    )
}

pub fn find_all_color_in_image(
    image: &RgbaImage,
    target: Rgb,
    tolerance: u8,
    origin_x: i32,
    origin_y: i32,
) -> Result<Vec<Point>> {
    let expected = (image.width * image.height * 4) as usize;
    if image.data.len() != expected {
        return Err(SpotterError::Image("invalid RGBA buffer length".into()));
    }

    let mut matches = Vec::new();
    for y in 0..image.height {
        let row = (y * image.width * 4) as usize;
        for x in 0..image.width {
            let offset = row + (x * 4) as usize;
            let actual = Rgb {
                r: image.data[offset],
                g: image.data[offset + 1],
                b: image.data[offset + 2],
            };
            if color_within(actual, target, tolerance) {
                matches.push(Point {
                    x: origin_x + x as i32,
                    y: origin_y + y as i32,
                });
            }
        }
    }
    Ok(matches)
}

pub fn find_color(target: Rgb, tolerance: u8, region: Option<Region>) -> Result<Option<Point>> {
    let image = capture_screen(region)?;
    let origin = region.unwrap_or(Region {
        left: 0,
        top: 0,
        width: image.width as i32,
        height: image.height as i32,
    });
    find_color_in_image(&image, target, tolerance, origin.left, origin.top)
}

pub fn find_all_color(target: Rgb, tolerance: u8, region: Option<Region>) -> Result<Vec<Point>> {
    let image = capture_screen(region)?;
    let origin = region.unwrap_or(Region {
        left: 0,
        top: 0,
        width: image.width as i32,
        height: image.height as i32,
    });
    find_all_color_in_image(&image, target, tolerance, origin.left, origin.top)
}

pub fn wait_for_color(
    x: i32,
    y: i32,
    target: Rgb,
    tolerance: u8,
    timeout_ms: u64,
    interval_ms: Option<u64>,
) -> Result<bool> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(interval_ms.unwrap_or(200));
    loop {
        let actual = get_pixel_color(x, y)?;
        if color_within(actual, target, tolerance) {
            return Ok(true);
        }
        if Instant::now() >= deadline {
            return Err(SpotterError::MatchTimeout { timeout_ms });
        }
        thread::sleep(interval);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image_2x2() -> RgbaImage {
        RgbaImage {
            width: 2,
            height: 2,
            data: vec![
                10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 40, 50, 61, 255,
            ],
        }
    }

    #[test]
    fn color_within_uses_per_channel_tolerance() {
        assert!(color_within(
            Rgb {
                r: 10,
                g: 20,
                b: 30
            },
            Rgb {
                r: 12,
                g: 18,
                b: 33
            },
            3
        ));
        assert!(!color_within(
            Rgb {
                r: 10,
                g: 20,
                b: 30
            },
            Rgb {
                r: 14,
                g: 20,
                b: 30
            },
            3
        ));
    }

    #[test]
    fn find_all_color_translates_local_pixels_to_origin() {
        let points = find_all_color_in_image(
            &image_2x2(),
            Rgb {
                r: 40,
                g: 50,
                b: 60,
            },
            1,
            100,
            200,
        )
        .unwrap();

        assert_eq!(
            points,
            vec![Point { x: 101, y: 200 }, Point { x: 101, y: 201 }]
        );
    }

    #[test]
    fn pixel_color_validates_buffer_and_bounds() {
        assert_eq!(
            pixel_color(&image_2x2(), 0, 1).unwrap(),
            Rgb {
                r: 70,
                g: 80,
                b: 90
            }
        );
        assert!(pixel_color(&image_2x2(), 3, 0).is_err());
        assert!(pixel_color(
            &RgbaImage {
                width: 1,
                height: 1,
                data: vec![0, 0, 0],
            },
            0,
            0
        )
        .is_err());
    }
}
