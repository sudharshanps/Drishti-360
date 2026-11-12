from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models.domain import User
from app.schemas.domain import TokenOut, UserLogin, UserOut, UserRegister
from app.utils.ids import generate_code

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenOut)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower().strip()).first():
        raise HTTPException(status_code=400, detail="Email is already registered.")
    user = User(
        user_uid=generate_code("USR"),
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        location=payload.location,
        is_demo=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.email, user.role)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    token = create_access_token(user.id, user.email, user.role)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/demo", response_model=TokenOut)
def demo_login(role: str = "farmer", db: Session = Depends(get_db)):
    email_map = {
        "farmer": "demo@drishti360.in",
        "fpo": "fpo@drishti360.in",
        "buyer": "buyer@drishti360.in",
    }
    target_email = email_map.get(role.lower(), "demo@drishti360.in")
    user = db.query(User).filter(User.email == target_email).first() or db.query(User).filter(User.email == "demo@drishti360.in").first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not seeded.")
    token = create_access_token(user.id, user.email, user.role)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))
