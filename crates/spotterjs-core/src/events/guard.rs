use std::sync::atomic::{AtomicUsize, Ordering};

static SYNTHETIC_DEPTH: AtomicUsize = AtomicUsize::new(0);

pub fn is_synthetic_input() -> bool {
    SYNTHETIC_DEPTH.load(Ordering::SeqCst) > 0
}

pub fn guard_synthetic_input<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    SYNTHETIC_DEPTH.fetch_add(1, Ordering::SeqCst);
    let result = f();
    SYNTHETIC_DEPTH.fetch_sub(1, Ordering::SeqCst);
    result
}
