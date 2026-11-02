import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Thông tin Supabase của bạn
const SUPABASE_URL = "https://yftmmdzqcbjgklluvjkp.supabase.co/";

const SUPABASE_ANON_KEY =
    "sb_publishable_Ct3QR3JpjOl6DwAKmPrQcw_K3Uib9MQ";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Các phần tử HTML
const filesInput = document.getElementById("files");
const memoryTitle = document.getElementById("memoryTitle");
const gallery = document.getElementById("gallery");
const empty = document.getElementById("empty");
const uploadStatus = document.getElementById("uploadStatus");

const viewer = document.getElementById("viewer");
const bigImage = document.getElementById("bigImage");
const bigCaption = document.getElementById("bigCaption");
const bigDate = document.getElementById("bigDate");

const manageButton = document.getElementById("manageButton");
const hiddenPanel = document.getElementById("hiddenPanel");
const hiddenList = document.getElementById("hiddenList");

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Định dạng ngày tháng
function formatDate(date) {
    return new Date(date).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

// Hiển thị ảnh
function renderPhotos(photos) {
    gallery.innerHTML = "";

    empty.style.display = photos.length === 0 ? "block" : "none";

    photos.forEach((photo, index) => {
        const card = document.createElement("div");
        card.className = "photo-item";

        const rotation = [-3, 2, -2, 3, 1, -1][index % 6];
        card.style.setProperty("--rotation", `${rotation}deg`);

        const image = document.createElement("img");
        image.src = photo.image_url;
        image.alt = photo.title || "Kỷ niệm";
        image.loading = "lazy";

        image.addEventListener("click", () => {
            openViewer(photo);
        });

        const caption = document.createElement("div");
        caption.className = "photo-caption";
        caption.textContent = photo.title || "Kỷ niệm";

        const date = document.createElement("div");
        date.className = "photo-date";
        date.textContent = formatDate(photo.created_at);

        const hideButton = document.createElement("button");
        hideButton.className = "hide-button";
        hideButton.textContent = "Ẩn ảnh khỏi website";

        hideButton.addEventListener("click", () => {
            hidePhoto(photo.id);
        });

        card.append(image, caption, date, hideButton);
        gallery.appendChild(card);
    });
}

// Tải danh sách ảnh công khai
async function loadPhotos() {
    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        uploadStatus.textContent = "Không thể tải danh sách ảnh.";
        return;
    }

    renderPhotos(data || []);
}

// Tải ảnh lên Supabase
filesInput.addEventListener("change", async () => {
    const files = Array.from(filesInput.files || []);
    const title = memoryTitle.value.trim();

    if (files.length === 0) return;

    if (!title) {
        alert("Bạn hãy nhập tên kỷ niệm trước nhé!");
        filesInput.value = "";
        return;
    }

    for (const file of files) {
        if (!file.type.startsWith("image/")) {
            alert(`${file.name} không phải là ảnh.`);
            filesInput.value = "";
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert(`${file.name} vượt quá giới hạn 5MB.`);
            filesInput.value = "";
            return;
        }
    }

    filesInput.disabled = true;

    let successCount = 0;

    for (const file of files) {
        uploadStatus.textContent =
            `Đang tải ảnh ${successCount + 1}/${files.length}...`;

        const extension = file.name.split(".").pop()
            .toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

        const fileName = `${crypto.randomUUID()}.${extension}`;
        const storagePath = `uploads/${Date.now()}-${fileName}`;

        // Tải file lên Storage
        const { error: uploadError } = await supabase
            .storage
            .from("photos")
            .upload(storagePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            console.error(uploadError);
            uploadStatus.textContent =
                `Không tải được ảnh ${file.name}.`;
            continue;
        }

        // Lấy đường dẫn ảnh công khai
        const { data: urlData } = supabase
            .storage
            .from("photos")
            .getPublicUrl(storagePath);

        // Lưu thông tin ảnh vào Database
        const { error: insertError } = await supabase
            .from("photos")
            .insert({
                title: title,
                image_url: urlData.publicUrl,
                storage_path: storagePath,
                is_hidden: false
            });

        if (insertError) {
            console.error(insertError);
            uploadStatus.textContent =
                `File đã tải lên nhưng chưa lưu được thông tin: ${file.name}`;
            continue;
        }

        successCount++;
    }

    uploadStatus.textContent =
        `Đã tải thành công ${successCount}/${files.length} ảnh!`;

    filesInput.value = "";
    filesInput.disabled = false;

    await loadPhotos();
});

// Mở ảnh lớn
function openViewer(photo) {
    bigImage.src = photo.image_url;
    bigCaption.textContent = photo.title || "Kỷ niệm";
    bigDate.textContent = formatDate(photo.created_at);

    viewer.classList.add("active");
}

// Đóng ảnh lớn
function closeViewer() {
    viewer.classList.remove("active");
    bigImage.src = "";
}

document.getElementById("closeViewer")
    .addEventListener("click", closeViewer);

viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeViewer();
});

// Gọi chức năng quản lý ảnh ở phía máy chủ
async function managePhoto(action, password, id = null) {
    const { data, error } = await supabase.functions.invoke(
        "manage-photo",
        {
            body: {
                action,
                password,
                id
            }
        }
    );

    if (error) {
        throw new Error(error.message || "Không thể kết nối chức năng quản lý.");
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

// Ẩn ảnh, không xóa file trong Storage
async function hidePhoto(id) {
    const password = prompt("Nhập mật khẩu để xóa ảnh:");

    if (password === null || password.trim() === "") return;

    try {
        await managePhoto("hide", password, id);

        alert("Đã xóa ảnh khỏi website!");

        await loadPhotos();
    } catch (error) {
        alert(error.message);
    }
}

// Mở danh sách ảnh đã ẩn
manageButton.addEventListener("click", async () => {
    const password = prompt("Nhập mật khẩu quản lý:");

    if (password === null || password.trim() === "") return;

    manageButton.disabled = true;

    try {
        const result = await managePhoto("list-hidden", password);

        hiddenPanel.hidden = false;
        hiddenList.innerHTML = "";

        const photos = result.photos || [];

        if (photos.length === 0) {
            hiddenList.textContent = "Chưa có ảnh nào bị ẩn.";
            return;
        }

        photos.forEach((photo) => {
            const item = document.createElement("div");
            item.className = "hidden-item";

            const name = document.createElement("span");
            name.textContent = photo.title || "Kỷ niệm";

            const button = document.createElement("button");
            button.className = "restore-button";
            button.textContent = "Khôi phục";

            button.addEventListener("click", async () => {
                try {
                    await managePhoto("restore", password, photo.id);
                    alert("Đã khôi phục ảnh!");

                    const refreshed = await managePhoto(
                        "list-hidden",
                        password
                    );

                    renderHiddenPhotos(refreshed.photos || [], password);
                    await loadPhotos();
                } catch (error) {
                    alert(error.message);
                }
            });

            item.append(name, button);
            hiddenList.appendChild(item);
        });

    } catch (error) {
        alert(error.message);
    } finally {
        manageButton.disabled = false;
    }
});

// Hiển thị lại danh sách ảnh đã ẩn
function renderHiddenPhotos(photos, password) {
    hiddenList.innerHTML = "";

    if (photos.length === 0) {
        hiddenList.textContent = "Chưa có ảnh nào bị ẩn.";
        return;
    }

    photos.forEach((photo) => {
        const item = document.createElement("div");
        item.className = "hidden-item";

        const name = document.createElement("span");
        name.textContent = photo.title || "Kỷ niệm";

        const button = document.createElement("button");
        button.className = "restore-button";
        button.textContent = "Khôi phục";

        button.addEventListener("click", async () => {
            try {
                await managePhoto("restore", password, photo.id);

                const refreshed = await managePhoto(
                    "list-hidden",
                    password
                );

                renderHiddenPhotos(refreshed.photos || [], password);
                await loadPhotos();

                alert("Đã khôi phục ảnh!");
            } catch (error) {
                alert(error.message);
            }
        });

        item.append(name, button);
        hiddenList.appendChild(item);
    });
}

// Hiệu ứng sao
const canvas = document.getElementById("stars");
const ctx = canvas.getContext("2d");

let stars = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    stars = Array.from({ length: 130 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        alpha: Math.random()
    }));
}

function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(220,230,255,${star.alpha})`;
        ctx.fill();

        star.alpha += (Math.random() - 0.5) * 0.05;
        star.alpha = Math.max(0.2, Math.min(1, star.alpha));
    });

    requestAnimationFrame(drawStars);
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
drawStars();

// Tải ảnh khi mở website
loadPhotos();